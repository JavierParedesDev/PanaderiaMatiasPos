const pool = require('../config/db');

/**
 * Obtener historial detallado de un producto específico
 */
const getHistorialProducto = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin puede ver el Kardex.' });

    const { id_producto, id_sucursal } = req.params;

    try {
        const query = `
            SELECT k.id, k.tipo_movimiento, k.cantidad, k.stock_posterior, k.fecha, 
                   u.username as responsable, k.referencia_id
            FROM kardex k
            JOIN usuarios u ON k.id_usuario = u.id
            WHERE k.id_producto = $1 AND k.id_sucursal = $2
            ORDER BY k.fecha DESC
        `;
        const result = await pool.query(query, [id_producto, id_sucursal]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al consultar el Kardex.' });
    }
};

/**
 * Obtener todos los movimientos recientes para auditoría global
 */
const getTodosLosMovimientos = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin puede ver el Kardex.' });

    try {
        const query = `
            SELECT 
                k.id, 
                k.tipo_movimiento, 
                k.cantidad, 
                k.stock_posterior, 
                k.fecha, 
                u.username as responsable, 
                p.nombre as producto,
                p.unidad,
                s.nombre as sucursal
            FROM kardex k
            JOIN usuarios u ON k.id_usuario = u.id
            JOIN productos p ON k.id_producto = p.id
            JOIN sucursales s ON k.id_sucursal = s.id
            ORDER BY k.fecha DESC
            LIMIT 100
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error Kardex:', error);
        res.status(500).json({ success: false, error: 'Error al obtener auditoría de movimientos.' });
    }
};

module.exports = { getHistorialProducto, getTodosLosMovimientos };
