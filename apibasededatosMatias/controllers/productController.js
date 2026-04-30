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

const csvValue = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    return `"${text.replace(/"/g, '""')}"`;
};

const exportarBackupProductos = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    const format = String(req.query.format || 'json').toLowerCase();

    try {
        const result = await pool.query(
            `SELECT
                p.*,
                c.nombre as categoria,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id_sucursal', i.id_sucursal,
                            'stock_actual', i.stock_actual,
                            'stock_minimo', i.stock_minimo
                        )
                    ) FILTER (WHERE i.id_sucursal IS NOT NULL),
                    '[]'::json
                ) as inventarios
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.id_categoria
             LEFT JOIN inventarios i ON i.id_producto = p.id
             GROUP BY p.id, c.nombre
             ORDER BY p.nombre ASC, p.id ASC`
        );

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (format === 'csv') {
            const headers = [
                'id',
                'codigo_interno',
                'codigo_barra_externo',
                'nombre',
                'unidad',
                'precio_costo',
                'precio_venta',
                'categoria',
                'activo',
                'pesable',
                'plu_balanza',
                'nombre_etiqueta',
                'activo_balanza'
            ];
            const lines = [
                headers.join(','),
                ...result.rows.map((row) => headers.map((header) => csvValue(row[header])).join(','))
            ];

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="backup_productos_${timestamp}.csv"`);
            return res.send(lines.join('\n'));
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="backup_productos_${timestamp}.json"`);
        res.send(JSON.stringify({
            success: true,
            exported_at: new Date().toISOString(),
            cantidad: result.rowCount,
            data: result.rows
        }, null, 2));
    } catch (error) {
        console.error('Error al exportar backup de productos:', error);
        res.status(500).json({ success: false, error: 'Error al exportar backup de productos.' });
    }
};

const getProductosBalanza = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    try {
        const result = await pool.query(
            `SELECT
                p.id,
                p.nombre,
                p.codigo_interno,
                p.codigo_barra_externo,
                p.precio_costo,
                p.precio_venta,
                p.pesable,
                p.plu_balanza,
                p.nombre_etiqueta,
                p.activo,
                p.activo_balanza,
                COALESCE(i.stock_actual, 0) as stock_actual,
                EXISTS (SELECT 1 FROM ventas_detalle vd WHERE vd.id_producto = p.id) as tiene_ventas,
                EXISTS (SELECT 1 FROM factura_detalle fd WHERE fd.id_producto = p.id) as tiene_facturas,
                EXISTS (SELECT 1 FROM kardex k WHERE k.id_producto = p.id) as tiene_kardex,
                EXISTS (
                    SELECT 1
                    FROM productos original
                    WHERE original.id <> p.id
                      AND UPPER(TRIM(original.nombre)) = UPPER(TRIM(p.nombre))
                ) as tiene_nombre_duplicado,
                (
                    p.pesable = TRUE
                    AND p.activo_balanza = TRUE
                    AND p.plu_balanza IS NOT NULL
                    AND p.codigo_interno IS NULL
                    AND COALESCE(p.precio_costo, 0) = 0
                    AND COALESCE(i.stock_actual, 0) = 0
                    AND NOT EXISTS (SELECT 1 FROM ventas_detalle vd WHERE vd.id_producto = p.id)
                    AND NOT EXISTS (SELECT 1 FROM factura_detalle fd WHERE fd.id_producto = p.id)
                    AND NOT EXISTS (SELECT 1 FROM kardex k WHERE k.id_producto = p.id)
                    AND EXISTS (
                        SELECT 1
                        FROM productos original
                        WHERE original.id <> p.id
                          AND UPPER(TRIM(original.nombre)) = UPPER(TRIM(p.nombre))
                    )
                ) as seguro_eliminar
             FROM productos p
             LEFT JOIN inventarios i ON i.id_producto = p.id
             WHERE p.codigo_interno IS NULL
               AND COALESCE(p.precio_costo, 0) = 0
               AND UPPER(COALESCE(p.unidad, '')) = 'KG'
               AND p.plu_balanza IS NOT NULL
               AND (
                    p.pesable = TRUE
                    OR p.activo_balanza = TRUE
                    OR p.nombre_etiqueta IS NOT NULL
               )
             ORDER BY seguro_eliminar DESC, p.nombre ASC, p.id DESC`
        );

        res.json({
            success: true,
            cantidad: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al listar productos de balanza:', error);
        res.status(500).json({ success: false, error: 'Error al listar productos de balanza.' });
    }
};

const getDuplicadosBalanza = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    try {
        const result = await pool.query(
            `WITH candidatos AS (
                SELECT
                    p.id,
                    p.nombre,
                    p.codigo_interno,
                    p.codigo_barra_externo,
                    p.precio_costo,
                    p.precio_venta,
                    p.pesable,
                    p.plu_balanza,
                    p.activo_balanza,
                    COALESCE(i.stock_actual, 0) as stock_actual,
                    EXISTS (SELECT 1 FROM ventas_detalle vd WHERE vd.id_producto = p.id) as tiene_ventas,
                    EXISTS (SELECT 1 FROM factura_detalle fd WHERE fd.id_producto = p.id) as tiene_facturas,
                    EXISTS (SELECT 1 FROM kardex k WHERE k.id_producto = p.id) as tiene_kardex,
                    EXISTS (
                        SELECT 1
                        FROM productos original
                        WHERE original.id <> p.id
                          AND UPPER(TRIM(original.nombre)) = UPPER(TRIM(p.nombre))
                    ) as tiene_nombre_duplicado
                FROM productos p
                LEFT JOIN inventarios i ON i.id_producto = p.id
                WHERE p.pesable = TRUE
                  AND p.activo_balanza = TRUE
                  AND p.plu_balanza IS NOT NULL
                  AND p.codigo_interno IS NULL
                  AND COALESCE(p.precio_costo, 0) = 0
            )
            SELECT *
            FROM candidatos
            WHERE tiene_nombre_duplicado = TRUE
              AND tiene_ventas = FALSE
              AND tiene_facturas = FALSE
              AND tiene_kardex = FALSE
              AND COALESCE(stock_actual, 0) = 0
            ORDER BY nombre ASC, id DESC`
        );

        res.json({
            success: true,
            cantidad: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al buscar duplicados de balanza:', error);
        res.status(500).json({ success: false, error: 'Error al buscar duplicados de balanza.' });
    }
};

const eliminarDuplicadosBalanza = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Solo administradores.' });
    }

    const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
    const force = normalizeBoolean(req.body?.force);

    if (!ids.length) {
        return res.status(400).json({ success: false, error: 'Debe indicar los IDs a eliminar.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const validacion = await client.query(
            `WITH candidatos AS (
                SELECT
                    p.id,
                    p.nombre,
                    COALESCE(i.stock_actual, 0) as stock_actual,
                    EXISTS (SELECT 1 FROM ventas_detalle vd WHERE vd.id_producto = p.id) as tiene_ventas,
                    EXISTS (SELECT 1 FROM factura_detalle fd WHERE fd.id_producto = p.id) as tiene_facturas,
                    EXISTS (SELECT 1 FROM kardex k WHERE k.id_producto = p.id) as tiene_kardex,
                    (
                        SELECT original.id
                        FROM productos original
                        WHERE original.id <> p.id
                          AND NOT (original.id = ANY($1::int[]))
                          AND UPPER(TRIM(original.nombre)) = UPPER(TRIM(p.nombre))
                        ORDER BY
                          CASE WHEN original.codigo_interno IS NOT NULL THEN 0 ELSE 1 END,
                          CASE WHEN original.activo = TRUE THEN 0 ELSE 1 END,
                          original.id ASC
                        LIMIT 1
                    ) as id_producto_destino,
                    EXISTS (
                        SELECT 1
                        FROM productos original
                        WHERE original.id <> p.id
                          AND UPPER(TRIM(original.nombre)) = UPPER(TRIM(p.nombre))
                    ) as tiene_nombre_duplicado
                FROM productos p
                LEFT JOIN inventarios i ON i.id_producto = p.id
                WHERE p.id = ANY($1::int[])
                  AND p.codigo_interno IS NULL
                  AND COALESCE(p.precio_costo, 0) = 0
                  AND UPPER(COALESCE(p.unidad, '')) = 'KG'
                  AND p.plu_balanza IS NOT NULL
                  AND (
                    p.pesable = TRUE
                    OR p.activo_balanza = TRUE
                    OR p.nombre_etiqueta IS NOT NULL
                  )
            )
            SELECT *
            FROM candidatos
            WHERE $2::boolean = TRUE
               OR (
                    tiene_ventas = FALSE
                    AND tiene_facturas = FALSE
                    AND tiene_nombre_duplicado = TRUE
                    AND tiene_kardex = FALSE
                    AND COALESCE(stock_actual, 0) = 0
               )`,
            [ids, force]
        );

        const validIds = validacion.rows.map((row) => Number(row.id));
        const blockedIds = ids.filter((id) => !validIds.includes(id));

        if (blockedIds.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: force
                    ? 'Hay productos fuera de la lista de balanza.'
                    : 'Hay productos que no cumplen las condiciones seguras para eliminar.',
                blockedIds
            });
        }

        if (force) {
            for (const row of validacion.rows) {
                const sourceId = Number(row.id);
                const targetId = Number(row.id_producto_destino || 0);

                if (targetId > 0) {
                    await client.query('UPDATE ventas_detalle SET id_producto = $1 WHERE id_producto = $2', [targetId, sourceId]);
                    await client.query('UPDATE factura_detalle SET id_producto = $1 WHERE id_producto = $2', [targetId, sourceId]);
                    await client.query('UPDATE kardex SET id_producto = $1 WHERE id_producto = $2', [targetId, sourceId]);
                    await client.query(
                        `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual, stock_minimo)
                         SELECT $1, id_sucursal, stock_actual, stock_minimo
                         FROM inventarios
                         WHERE id_producto = $2
                         ON CONFLICT (id_producto, id_sucursal)
                         DO UPDATE SET
                            stock_actual = inventarios.stock_actual + EXCLUDED.stock_actual,
                            stock_minimo = GREATEST(COALESCE(inventarios.stock_minimo, 0), COALESCE(EXCLUDED.stock_minimo, 0))`,
                        [targetId, sourceId]
                    );
                } else {
                    await client.query('DELETE FROM ventas_detalle WHERE id_producto = $1', [sourceId]);
                    await client.query('DELETE FROM factura_detalle WHERE id_producto = $1', [sourceId]);
                    await client.query('DELETE FROM kardex WHERE id_producto = $1', [sourceId]);
                }
            }
        }
        await client.query('DELETE FROM inventarios WHERE id_producto = ANY($1::int[])', [validIds]);
        const deleted = await client.query('DELETE FROM productos WHERE id = ANY($1::int[]) RETURNING id, nombre', [validIds]);

        await client.query('COMMIT');

        res.json({
            success: true,
            mensaje: `Duplicados de balanza eliminados: ${deleted.rowCount}.`,
            data: deleted.rows
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar duplicados de balanza:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar duplicados de balanza.' });
    } finally {
        client.release();
    }
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
                    WHEN p.precio_venta > 0
                    THEN ROUND(((p.precio_venta - p.precio_costo) / p.precio_venta) * 100, 2)
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
    exportarBackupProductos,
    getProductosBalanza,
    getDuplicadosBalanza,
    eliminarDuplicadosBalanza,
    exportarProductosLabelNet,
    importarProductosLabelNet,
    crearProducto,
    actualizarProducto,
    eliminarProducto
};
