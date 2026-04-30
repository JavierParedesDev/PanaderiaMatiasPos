const pool = require('../config/db');

const resolveSucursalId = (req, fallbackSucursal) => {
    const requested = Number(fallbackSucursal ?? req.query.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    return req.usuario.id_sucursal;
};

/**
 * Obtener historial detallado de un producto específico
 */
const getHistorialProducto = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin puede ver el Kardex.' });

    const id_producto = Number(req.params.id_producto);
    const id_sucursal = resolveSucursalId(req, req.params.id_sucursal);

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
        res.json({ success: true, id_sucursal, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al consultar el Kardex.' });
    }
};

/**
 * Obtener movimientos recientes filtrados por sucursal
 */
const getTodosLosMovimientos = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin puede ver el Kardex.' });

    const id_sucursal = resolveSucursalId(req);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 30);
    const offset = (page - 1) * limit;

    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM kardex WHERE id_sucursal = $1', [id_sucursal]);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

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
            WHERE k.id_sucursal = $1
            ORDER BY k.fecha DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [id_sucursal, limit, offset]);
        res.json({ 
            success: true, 
            id_sucursal, 
            data: result.rows,
            page,
            total_pages: totalPages,
            total_items: totalItems
        });
    } catch (error) {
        console.error('Error Kardex:', error);
        res.status(500).json({ success: false, error: 'Error al obtener auditoría de movimientos.' });
    }
};

module.exports = { getHistorialProducto, getTodosLosMovimientos };
