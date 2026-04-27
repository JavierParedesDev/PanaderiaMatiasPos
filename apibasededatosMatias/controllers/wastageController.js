const pool = require('../config/db');

const registrarMerma = async (req, res) => {
    const { id_producto, cantidad, motivo } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Iniciar transacción segura

        // 1. Insertar el registro de la merma
        await client.query(
            `INSERT INTO mermas (fecha, id_producto, id_sucursal, cantidad, motivo, id_usuario) 
             VALUES (NOW(), $1, $2, $3, $4, $5)`,
            [id_producto, id_sucursal, cantidad, motivo, id_usuario]
        );

        // 2. Descontar del inventario de la sucursal
        const resStock = await client.query(
            `UPDATE inventarios 
             SET stock_actual = stock_actual - $1 
             WHERE id_producto = $2 AND id_sucursal = $3 
             RETURNING stock_actual`,
            [cantidad, id_producto, id_sucursal]
        );

        if (resStock.rows.length === 0) {
            throw new Error('El producto no tiene inventario en esta sucursal.');
        }
        const stock_posterior = resStock.rows[0].stock_actual;

        // 3. Registrar el movimiento en el Kardex
        await client.query(
            `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario) 
             VALUES ($1, $2, 'MERMA', $3, $4, NOW(), $5)`,
            [id_producto, id_sucursal, -cantidad, stock_posterior, id_usuario]
        );

        await client.query('COMMIT');
        res.json({ success: true, mensaje: 'Merma registrada y stock actualizado.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar merma:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al procesar la merma.' });
    } finally {
        client.release();
    }
};

module.exports = { registrarMerma };
