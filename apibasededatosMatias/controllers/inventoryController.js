const pool = require('../config/db');

// 1. Consultar el stock de todos los productos en la sucursal del usuario
const getStockLocal = async (req, res) => {
    const id_sucursal = req.usuario.id_sucursal;
    
    try {
        const query = `
            SELECT p.id, p.codigo_interno, p.nombre, p.unidad, COALESCE(i.stock_actual, 0) as stock_actual
            FROM productos p
            LEFT JOIN inventarios i ON p.id = i.id_producto AND i.id_sucursal = $1
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC
        `;
        const result = await pool.query(query, [id_sucursal]);
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error al consultar stock:', error);
        res.status(500).json({ success: false, error: 'Error al consultar el inventario.' });
    }
};

// 2. Realizar un ajuste manual (Ej: sumar 2 panes que sobraron, o restar 1 bebida que se rompió y no se registró como merma)
const ajustarStock = async (req, res) => {
    const { id_producto, cantidad_ajustada, observacion } = req.body; 
    // cantidad_ajustada puede ser positiva (ej: 5) o negativa (ej: -2)
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // A. Registrar el motivo del ajuste
        await client.query(
            `INSERT INTO ajustes_inventario (id_producto, id_sucursal, cantidad_ajustada, observacion, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [id_producto, id_sucursal, cantidad_ajustada, observacion, id_usuario]
        );

        // B. Actualizar inventario (si no existe el producto en esta sucursal, lo crea)
        let stock_posterior = 0;
        const resStock = await client.query(
            `UPDATE inventarios
             SET stock_actual = stock_actual + $1
             WHERE id_producto = $2 AND id_sucursal = $3
             RETURNING stock_actual`,
            [cantidad_ajustada, id_producto, id_sucursal]
        );

        if (resStock.rows.length === 0) {
             const insertStock = await client.query(
                 `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual)
                  VALUES ($1, $2, $3) RETURNING stock_actual`,
                 [id_producto, id_sucursal, cantidad_ajustada]
             );
             stock_posterior = insertStock.rows[0].stock_actual;
        } else {
             stock_posterior = resStock.rows[0].stock_actual;
        }

        // C. Guardar en Kardex para auditoría
        await client.query(
            `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario)
             VALUES ($1, $2, 'AJUSTE', $3, $4, NOW(), $5)`,
            [id_producto, id_sucursal, cantidad_ajustada, stock_posterior, id_usuario]
        );

        await client.query('COMMIT');
        res.json({ success: true, mensaje: 'Ajuste de inventario realizado.', stock_actual: stock_posterior });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al ajustar stock:', error);
        res.status(500).json({ success: false, error: 'Error al procesar el ajuste.' });
    } finally {
        client.release();
    }
};

module.exports = { getStockLocal, ajustarStock };
