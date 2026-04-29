const pool = require('../config/db');

const LABELNET_DEFAULT_MG = 997;

const resolveSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    return req.usuario.id_sucursal;
};

const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const parseOptionalInteger = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeLabelNetName = (nombreEtiqueta, nombreProducto) => {
    const source = (nombreEtiqueta || nombreProducto || '').trim().toUpperCase();
    return source.slice(0, 120) || null;
};

const parseMoney = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLabelNetImportRow = (row) => {
    const plu = parseOptionalInteger(row.plu_balanza ?? row.PLU_No ?? row.plu ?? row['PLU Code']);
    const nombre = String(row.nombre ?? row.Name ?? row.name ?? '').trim();
    const codigoBarra = String(row.codigo_barra_externo ?? row.PLU_EANItemCode ?? row.ItemCode ?? row['Item Code'] ?? '').trim() || null;

    return {
        plu_balanza: plu,
        nombre,
        precio_venta: parseMoney(row.precio_venta ?? row.PLU_UPrice ?? row['Unit Price']),
        codigo_barra_externo: codigoBarra,
        mg: row.mg ?? row.PLU_MG ?? null
    };
};

/**
 * Obtener catálogo de productos
 * Incluye cálculos de utilidad y margen
 */
const getProductos = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const query = `
            SELECT
                p.id,
                p.codigo_interno,
                p.codigo_barra_externo,
                p.nombre,
                p.unidad,
                p.precio_costo,
                p.precio_venta,
                c.nombre as categoria,
                p.id_categoria,
                p.impuesto_especifico,
                p.activo,
                p.pesable,
                p.plu_balanza,
                p.nombre_etiqueta,
                p.activo_balanza,
                COALESCE(i.stock_actual, 0) as stock_actual,
                COALESCE(i.stock_minimo, 0) as stock_minimo,
                (p.precio_venta - p.precio_costo) as utilidad_pesos,
                CASE
                    WHEN p.precio_costo > 0
                    THEN ROUND(((p.precio_venta - p.precio_costo) / p.precio_costo) * 100, 2)
                    ELSE 0
                END as margen_porcentaje
            FROM productos p
            LEFT JOIN categorias c ON p.id_categoria = c.id
            LEFT JOIN inventarios i ON p.id = i.id_producto AND i.id_sucursal = $1
            ORDER BY p.nombre ASC;
        `;
        const result = await pool.query(query, [id_sucursal]);
        res.json({ success: true, id_sucursal, cantidad: result.rowCount, data: result.rows });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener el catálogo.' });
    }
};

/**
 * Exportar productos para LabelNet
 */
const exportarProductosLabelNet = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    const requestedPlu = parseOptionalInteger(req.query.plu_balanza);
    const includeHeader = req.query.header !== 'false';
    const exportFormat = String(req.query.format || 'standard').toLowerCase();

    try {
        const query = `
            SELECT
                plu_balanza,
                nombre,
                nombre_etiqueta,
                precio_venta,
                codigo_barra_externo,
                activo_balanza
            FROM productos
            WHERE pesable = TRUE
              AND activo = TRUE
              AND activo_balanza = TRUE
              AND plu_balanza IS NOT NULL
              AND ($1::int IS NULL OR plu_balanza = $1)
            ORDER BY plu_balanza ASC, nombre ASC
        `;
        const result = await pool.query(query, [requestedPlu]);

        const lines = result.rows.map((row) => {
            const plu = row.plu_balanza ?? '';
            const price = row.precio_venta ?? 0;
            const eanCode = row.codigo_barra_externo ?? '';
            const name = normalizeLabelNetName(row.nombre_etiqueta, row.nombre) || '';

            if (exportFormat === 'legacy') {
                return `${name}\t${price}\t${plu}\t${eanCode}\t20\t1`;
            }

            return `${plu}\t${price}\t0\t${eanCode}\t${LABELNET_DEFAULT_MG}\t${name}`;
        });

        if (includeHeader) {
            if (exportFormat === 'legacy') {
                lines.unshift('PLU_Commodity\tPLU_UPrice\tPLU_No\tPLU_EANItemCode\tPLU_BarFormat\tPLU_PAKDate');
            } else {
                lines.unshift('PLU_No\tPLU_UPrice\tStat1_UPriceOV\tPLU_EANItemCode\tPLU_MG\tPLU_CommodityFirst');
            }
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="labelnet_productos.txt"');
        res.send(lines.join('\n'));
    } catch (error) {
        console.error('Error al exportar LabelNet:', error);
        res.status(500).json({ success: false, error: 'Error al exportar productos para LabelNet.' });
    }
};

/**
 * Importar PLU extraidos desde LabelNet / balanza DIGI
 */
const importarProductosLabelNet = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    const rows = Array.isArray(req.body?.productos) ? req.body.productos : [];
    const idCategoriaDefault = parseOptionalInteger(req.body?.id_categoria) || null;
    const unidadDefault = String(req.body?.unidad || 'KG').trim().toUpperCase() || 'KG';

    if (!rows.length) {
        return res.status(400).json({ success: false, error: 'No se recibieron productos para importar.' });
    }

    const resumen = {
        recibidos: rows.length,
        creados: 0,
        actualizados: 0,
        omitidos: 0,
        errores: []
    };

    for (let index = 0; index < rows.length; index += 1) {
        const source = rows[index];
        const producto = normalizeLabelNetImportRow(source);

        if (!producto.plu_balanza || !producto.nombre) {
            resumen.omitidos += 1;
            resumen.errores.push({
                fila: index + 1,
                error: 'Fila omitida: falta PLU o nombre.'
            });
            continue;
        }

        try {
            const existing = await pool.query(
                `SELECT id
                 FROM productos
                 WHERE plu_balanza = $1
                    OR ($2::text IS NOT NULL AND codigo_barra_externo = $2)
                 ORDER BY CASE WHEN plu_balanza = $1 THEN 0 ELSE 1 END
                 LIMIT 1`,
                [producto.plu_balanza, producto.codigo_barra_externo]
            );

            if (existing.rowCount > 0) {
                await pool.query(
                    `UPDATE productos
                     SET codigo_barra_externo = COALESCE($1, codigo_barra_externo),
                         nombre = $2,
                         unidad = COALESCE(NULLIF(unidad, ''), $3),
                         precio_venta = $4,
                         activo = TRUE,
                         pesable = TRUE,
                         plu_balanza = $5,
                         nombre_etiqueta = $6,
                         activo_balanza = TRUE
                     WHERE id = $7`,
                    [
                        producto.codigo_barra_externo,
                        producto.nombre.toUpperCase(),
                        unidadDefault,
                        producto.precio_venta,
                        producto.plu_balanza,
                        normalizeLabelNetName(producto.nombre, producto.nombre),
                        existing.rows[0].id
                    ]
                );
                resumen.actualizados += 1;
                continue;
            }

            await pool.query(
                `INSERT INTO productos (
                    codigo_interno, codigo_barra_externo, nombre, unidad,
                    precio_costo, precio_venta, id_categoria, impuesto_especifico,
                    activo, pesable, plu_balanza, nombre_etiqueta, activo_balanza
                )
                VALUES ($1, $2, $3, $4, 0, $5, $6, 0, TRUE, TRUE, $7, $8, TRUE)`,
                [
                    null,
                    producto.codigo_barra_externo,
                    producto.nombre.toUpperCase(),
                    unidadDefault,
                    producto.precio_venta,
                    idCategoriaDefault,
                    producto.plu_balanza,
                    normalizeLabelNetName(producto.nombre, producto.nombre)
                ]
            );
            resumen.creados += 1;
        } catch (error) {
            resumen.omitidos += 1;
            resumen.errores.push({
                fila: index + 1,
                plu_balanza: producto.plu_balanza,
                nombre: producto.nombre,
                error: error.message
            });
        }
    }

    res.json({
        success: true,
        mensaje: `Importacion terminada. Creados: ${resumen.creados}. Actualizados: ${resumen.actualizados}. Omitidos: ${resumen.omitidos}.`,
        data: resumen
    });
};

/**
 * Crear nuevo producto
 */
const crearProducto = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden crear productos.' });
    }

    const {
        codigo_interno,
        codigo_barra_externo,
        nombre,
        unidad,
        precio_costo,
        precio_venta,
        id_categoria,
        impuesto_especifico,
        pesable,
        plu_balanza,
        nombre_etiqueta,
        activo_balanza
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO productos (
                codigo_interno, codigo_barra_externo, nombre, unidad,
                precio_costo, precio_venta, id_categoria, impuesto_especifico,
                pesable, plu_balanza, nombre_etiqueta, activo_balanza
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                codigo_interno,
                codigo_barra_externo,
                nombre ? nombre.toUpperCase() : null,
                unidad,
                precio_costo || 0,
                precio_venta || 0,
                id_categoria,
                impuesto_especifico || 0,
                normalizeBoolean(pesable),
                parseOptionalInteger(plu_balanza),
                normalizeLabelNetName(nombre_etiqueta, nombre),
                normalizeBoolean(activo_balanza)
            ]
        );
        res.status(201).json({ success: true, mensaje: 'Producto creado exitosamente.', producto: result.rows[0] });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: 'Error al crear producto. Verifique si el código o PLU ya existe.' });
    }
};

/**
 * Actualizar producto
 */
const actualizarProducto = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { id } = req.params;
    const {
        codigo_interno,
        codigo_barra_externo,
        nombre,
        unidad,
        precio_costo,
        precio_venta,
        id_categoria,
        activo,
        pesable,
        plu_balanza,
        nombre_etiqueta,
        activo_balanza
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE productos
             SET codigo_interno = $1,
                 codigo_barra_externo = $2,
                 nombre = $3,
                 unidad = $4,
                 precio_costo = $5,
                 precio_venta = $6,
                 id_categoria = $7,
                 activo = $8,
                 pesable = $9,
                 plu_balanza = $10,
                 nombre_etiqueta = $11,
                 activo_balanza = $12
             WHERE id = $13 RETURNING *`,
            [
                codigo_interno,
                codigo_barra_externo,
                nombre ? nombre.toUpperCase() : null,
                unidad,
                precio_costo || 0,
                precio_venta || 0,
                id_categoria,
                activo,
                normalizeBoolean(pesable),
                parseOptionalInteger(plu_balanza),
                normalizeLabelNetName(nombre_etiqueta, nombre),
                normalizeBoolean(activo_balanza),
                id
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
        }

        res.json({ success: true, mensaje: 'Producto actualizado.', producto: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar producto.' });
    }
};

/**
 * Eliminación Física (DELETE)
 */
const eliminarProducto = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { id } = req.params;

    try {
        await pool.query('DELETE FROM productos WHERE id = $1', [id]);

        res.json({
            success: true,
            mensaje: 'Producto eliminado definitivamente de la base de datos.'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);

        if (error.code === '23503') {
            return res.status(400).json({
                success: false,
                error: 'No se puede eliminar de la base de datos porque el producto tiene historial de ventas o movimientos. Le recomendamos desactivarlo en su lugar.'
            });
        }

        res.status(500).json({ success: false, error: 'Error interno al procesar la eliminación.' });
    }
};

module.exports = {
    getProductos,
    exportarProductosLabelNet,
    importarProductosLabelNet,
    crearProducto,
    actualizarProducto,
    eliminarProducto
};
