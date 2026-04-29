const pool = require('../config/db');

const parseOptionalInteger = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const ingresarFactura = async (req, res) => {
    const { numero_factura, id_proveedor, fecha_emision, monto_total, detalle_productos } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    if (!numero_factura) {
        return res.status(400).json({ success: false, error: 'Debe indicar el numero de factura.' });
    }

    if (!Number.isInteger(Number(id_proveedor)) || Number(id_proveedor) <= 0) {
        return res.status(400).json({ success: false, error: 'Debe indicar un proveedor valido.' });
    }

    if (!Array.isArray(detalle_productos) || detalle_productos.length === 0) {
        return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto a la factura.' });
    }

    for (const item of detalle_productos) {
        if (!Number.isInteger(Number(item.id_producto)) || Number(item.id_producto) <= 0) {
            return res.status(400).json({ success: false, error: 'Debe seleccionar un producto valido.' });
        }

        if (!Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
            return res.status(400).json({ success: false, error: 'La cantidad ingresada debe ser mayor a cero.' });
        }

        if (!Number.isFinite(Number(item.costo_unitario)) || Number(item.costo_unitario) < 0) {
            return res.status(400).json({ success: false, error: 'El costo unitario no puede ser negativo.' });
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const providerExists = await client.query('SELECT id FROM proveedores WHERE id = $1', [id_proveedor]);
        if (providerExists.rowCount === 0) {
            throw new Error(`Proveedor ID ${id_proveedor} no existe.`);
        }

        // 1. Guardar la Cabecera de la Factura
        const resFactura = await client.query(
            `INSERT INTO facturas_ingreso (numero_factura, id_proveedor, fecha_emision, id_sucursal, monto_total) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [numero_factura, id_proveedor, fecha_emision, id_sucursal, monto_total]
        );
        const id_factura = resFactura.rows[0].id;

        // 2. Procesar cada producto ingresado
        for (const item of detalle_productos) {
            const productExists = await client.query('SELECT id FROM productos WHERE id = $1', [item.id_producto]);
            if (productExists.rowCount === 0) {
                throw new Error(`Producto ID ${item.id_producto} no existe.`);
            }

            await client.query(
                `INSERT INTO factura_detalle (id_factura, id_producto, cantidad, costo_unitario) 
                 VALUES ($1, $2, $3, $4)`,
                [id_factura, item.id_producto, item.cantidad, item.costo_unitario]
            );

            if (Number(item.costo_unitario) > 0) {
                await client.query(
                    `UPDATE productos
                     SET precio_costo = $1
                     WHERE id = $2`,
                    [item.costo_unitario, item.id_producto]
                );
            }

            // SUMAR al inventario (o crearlo si no existe en la sucursal)
            const resStock = await client.query(
                `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual) 
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id_producto, id_sucursal) 
                 DO UPDATE SET stock_actual = inventarios.stock_actual + EXCLUDED.stock_actual
                 RETURNING stock_actual`,
                [item.id_producto, id_sucursal, item.cantidad]
            );
            const stock_posterior = resStock.rows[0].stock_actual;

            // Registrar en el Kardex como COMPRA
            await client.query(
                `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario, referencia_id) 
                 VALUES ($1, $2, 'COMPRA', $3, $4, NOW(), $5, $6)`,
                [item.id_producto, id_sucursal, item.cantidad, stock_posterior, id_usuario, id_factura]
            );
        }

        await client.query('COMMIT'); 
        res.json({ success: true, mensaje: 'Factura ingresada y stock actualizado correctamente.', id_factura });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("Error al ingresar factura:", error);
        const status = ['23503', '23505'].includes(error.code) ? 400 : 500;
        res.status(status).json({ success: false, error: error.message || 'Error al procesar la factura.' });
    } finally {
        client.release();
    }
};

const getFacturasIngreso = async (req, res) => {
    const requestedSucursal = parseOptionalInteger(req.query.id_sucursal);
    const id_sucursal = req.usuario?.rol === 'Admin' ? requestedSucursal : req.usuario.id_sucursal;
    const fecha_desde = req.query.fecha_desde || null;
    const fecha_hasta = req.query.fecha_hasta || null;
    const folio = req.query.folio ? `%${String(req.query.folio).trim()}%` : null;
    const id_proveedor = parseOptionalInteger(req.query.id_proveedor);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 5;
    const offset = (page - 1) * limit;

    try {
        const countResult = await pool.query(
            `SELECT COUNT(*)::int as total
             FROM facturas_ingreso f
             WHERE ($1::int IS NULL OR f.id_sucursal = $1)
               AND ($2::date IS NULL OR f.fecha_emision::date >= $2::date)
               AND ($3::date IS NULL OR f.fecha_emision::date <= $3::date)
               AND ($4::text IS NULL OR f.numero_factura ILIKE $4)
               AND ($5::int IS NULL OR f.id_proveedor = $5)`,
            [id_sucursal, fecha_desde, fecha_hasta, folio, id_proveedor]
        );

        const result = await pool.query(
            `SELECT
                f.id,
                f.numero_factura,
                f.id_proveedor,
                COALESCE(p.nombre_empresa, 'Proveedor sin nombre') as proveedor,
                f.fecha_emision,
                f.id_sucursal,
                COALESCE(s.nombre, 'Sucursal') as sucursal,
                f.monto_total,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id_producto', fd.id_producto,
                            'producto', pr.nombre,
                            'cantidad', fd.cantidad,
                            'costo_unitario', fd.costo_unitario,
                            'subtotal', fd.cantidad * fd.costo_unitario
                        )
                        ORDER BY pr.nombre
                    ) FILTER (WHERE fd.id_factura IS NOT NULL),
                    '[]'::json
                ) as detalle
             FROM facturas_ingreso f
             LEFT JOIN proveedores p ON p.id = f.id_proveedor
             LEFT JOIN sucursales s ON s.id = f.id_sucursal
             LEFT JOIN factura_detalle fd ON fd.id_factura = f.id
             LEFT JOIN productos pr ON pr.id = fd.id_producto
             WHERE ($1::int IS NULL OR f.id_sucursal = $1)
               AND ($2::date IS NULL OR f.fecha_emision::date >= $2::date)
               AND ($3::date IS NULL OR f.fecha_emision::date <= $3::date)
               AND ($4::text IS NULL OR f.numero_factura ILIKE $4)
               AND ($5::int IS NULL OR f.id_proveedor = $5)
             GROUP BY f.id, p.nombre_empresa, s.nombre
             ORDER BY f.fecha_emision DESC, f.id DESC
             LIMIT $6 OFFSET $7`,
            [id_sucursal, fecha_desde, fecha_hasta, folio, id_proveedor, limit, offset]
        );

        const total = countResult.rows[0]?.total || 0;
        res.json({
            success: true,
            cantidad: result.rowCount,
            page,
            limit,
            total,
            total_pages: Math.max(1, Math.ceil(total / limit)),
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener facturas de ingreso:', error);
        res.status(500).json({ success: false, error: 'Error al obtener historial de facturas.' });
    }
};

module.exports = { ingresarFactura, getFacturasIngreso };

