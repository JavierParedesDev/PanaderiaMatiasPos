const pool = require('../config/db');

const resolveSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    if (req.usuario?.rol === 'Admin') {
        return null;
    }

    return req.usuario.id_sucursal;
};

const procesarVenta = async (req, res) => {
    const { id_turno, total_venta, detalle_productos, pagos_mixtos } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resVenta = await client.query(
            `INSERT INTO ventas_cabecera (folio_interno, fecha, id_usuario, id_sucursal, id_turno, total_venta)
             VALUES (COALESCE((SELECT MAX(folio_interno) + 1 FROM ventas_cabecera WHERE id_sucursal = $2), 1), timezone('America/Santiago', now()), $1, $2, $3, $4) RETURNING id, folio_interno`,
            [id_usuario, id_sucursal, id_turno, total_venta]
        );
        const id_venta = resVenta.rows[0].id;
        const folio_interno = resVenta.rows[0].folio_interno;

        for (const pago of pagos_mixtos) {
            await client.query(
                `INSERT INTO ventas_pagos (id_venta, id_metodo_pago, monto_pagado) VALUES ($1, $2, $3)`,
                [id_venta, pago.id_metodo_pago, pago.monto_pagado]
            );
        }

        for (const item of detalle_productos) {
            await client.query(
                `INSERT INTO ventas_detalle (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
                [id_venta, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal]
            );

            const resStock = await client.query(
                `UPDATE inventarios
                 SET stock_actual = stock_actual - $1
                 WHERE id_producto = $2 AND id_sucursal = $3 AND stock_actual >= $1
                 RETURNING stock_actual`,
                [item.cantidad, item.id_producto, id_sucursal]
            );
            if (resStock.rows.length === 0) throw new Error(`Stock insuficiente para producto ID ${item.id_producto}`);

            await client.query(
                `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario, referencia_id) VALUES ($1, $2, 'VENTA', $3, $4, timezone('America/Santiago', now()), $5, $6)`,
                [item.id_producto, id_sucursal, -item.cantidad, resStock.rows[0].stock_actual, id_usuario, id_venta]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, mensaje: 'Venta registrada con éxito', venta: { id: id_venta, folio: folio_interno } });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message || 'Error al procesar la venta.' });
    } finally {
        client.release();
    }
};

// Obtener historial de tickets filtrado por sucursal
const getHistorialVentas = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const query = `
            SELECT vc.id, vc.folio_interno, vc.fecha, vc.total_venta, u.username as vendedor, s.nombre as sucursal
            FROM ventas_cabecera vc
            JOIN usuarios u ON vc.id_usuario = u.id
            JOIN sucursales s ON vc.id_sucursal = s.id
            WHERE ($1::int IS NULL OR vc.id_sucursal = $1)
            ORDER BY vc.fecha DESC
            LIMIT 100
        `;
        const result = await pool.query(query, [id_sucursal]);
        res.json({ success: true, id_sucursal, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener historial de ventas.' });
    }
};

module.exports = { procesarVenta, getHistorialVentas };
