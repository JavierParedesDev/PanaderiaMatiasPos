const pool = require('../config/db');

const ingresarFactura = async (req, res) => {
    const { numero_factura, id_proveedor, fecha_emision, monto_total, detalle_productos } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia transacción

        // 1. Guardar la Cabecera de la Factura
        const resFactura = await client.query(
            `INSERT INTO facturas_ingreso (numero_factura, id_proveedor, fecha_emision, id_sucursal, monto_total) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [numero_factura, id_proveedor, fecha_emision, id_sucursal, monto_total]
        );
        const id_factura = resFactura.rows[0].id;

        // 2. Procesar cada producto ingresado
        for (const item of detalle_productos) {
            await client.query(
                `INSERT INTO factura_detalle (id_factura, id_producto, cantidad, costo_unitario) 
                 VALUES ($1, $2, $3, $4)`,
                [id_factura, item.id_producto, item.cantidad, item.costo_unitario]
            );

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
        res.json({ success: true, mensaje: 'Factura ingresada y stock actualizado correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("Error al ingresar factura:", error);
        res.status(500).json({ success: false, error: 'Error al procesar la factura.' });
    } finally {
        client.release();
    }
};

module.exports = { ingresarFactura };
