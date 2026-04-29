const pool = require('../config/db');

const resolveSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal ?? req.body.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    return req.usuario.id_sucursal;
};

const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

// 1. Consultar el stock de todos los productos en la sucursal seleccionada
const getStockLocal = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const query = `
            SELECT
                p.id,
                p.codigo_interno,
                p.nombre,
                p.unidad,
                COALESCE(i.stock_actual, 0) as stock_actual,
                COALESCE(i.stock_minimo, 0) as stock_minimo
            FROM productos p
            LEFT JOIN inventarios i ON p.id = i.id_producto AND i.id_sucursal = $1
            WHERE p.activo = TRUE
            ORDER BY p.nombre ASC
        `;
        const result = await pool.query(query, [id_sucursal]);

        res.json({ success: true, id_sucursal, data: result.rows });
    } catch (error) {
        console.error('Error al consultar stock:', error);
        res.status(500).json({ success: false, error: 'Error al consultar el inventario.' });
    }
};

// 2. Realizar un ajuste manual delta
const ajustarStock = async (req, res) => {
    const id_producto = Number(req.body.id_producto);
    const cantidad_ajustada = parseNumber(req.body.cantidad_ajustada);
    const observacion = req.body.observacion?.trim() || '';
    const id_usuario = req.usuario.id;
    const id_sucursal = resolveSucursalId(req);

    if (!Number.isInteger(id_producto) || id_producto <= 0) {
        return res.status(400).json({ success: false, error: 'Debe indicar un producto válido.' });
    }

    if (cantidad_ajustada === null || cantidad_ajustada === 0) {
        return res.status(400).json({ success: false, error: 'La cantidad ajustada debe ser distinta de cero.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const stockActualResult = await client.query(
            `SELECT stock_actual
             FROM inventarios
             WHERE id_producto = $1 AND id_sucursal = $2
             FOR UPDATE`,
            [id_producto, id_sucursal]
        );

        const stockAnterior = stockActualResult.rows.length ? Number(stockActualResult.rows[0].stock_actual) : 0;
        const stockPosteriorCalculado = stockAnterior + cantidad_ajustada;

        if (stockPosteriorCalculado < 0) {
            throw new Error('El ajuste no puede dejar stock negativo.');
        }

        await client.query(
            `INSERT INTO ajustes_inventario (id_producto, id_sucursal, cantidad_ajustada, observacion, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [id_producto, id_sucursal, cantidad_ajustada, observacion, id_usuario]
        );

        const stockResult = await client.query(
            `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual)
             VALUES ($1, $2, $3)
             ON CONFLICT (id_producto, id_sucursal)
             DO UPDATE SET stock_actual = EXCLUDED.stock_actual
             RETURNING stock_actual`,
            [id_producto, id_sucursal, stockPosteriorCalculado]
        );

        const stock_posterior = Number(stockResult.rows[0].stock_actual);

        await client.query(
            `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario)
             VALUES ($1, $2, 'AJUSTE', $3, $4, NOW(), $5)`,
            [id_producto, id_sucursal, cantidad_ajustada, stock_posterior, id_usuario]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            mensaje: 'Ajuste de inventario realizado.',
            id_sucursal,
            stock_actual: stock_posterior
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al ajustar stock:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al procesar el ajuste.' });
    } finally {
        client.release();
    }
};

// 3. Fijar stock absoluto para inicialización o corrección
const fijarStockProducto = async (req, res) => {
    const id_producto = Number(req.params.id_producto);
    const stockObjetivo = parseNumber(req.body.stock_actual);
    const stockMinimo = req.body.stock_minimo === undefined ? undefined : parseNumber(req.body.stock_minimo);
    const observacion = req.body.observacion?.trim() || 'Ajuste de stock absoluto';
    const id_usuario = req.usuario.id;
    const id_sucursal = resolveSucursalId(req);

    if (!Number.isInteger(id_producto) || id_producto <= 0) {
        return res.status(400).json({ success: false, error: 'Debe indicar un producto válido.' });
    }

    if (stockObjetivo === null || stockObjetivo < 0) {
        return res.status(400).json({ success: false, error: 'El stock_actual debe ser un número mayor o igual a cero.' });
    }

    if (req.body.stock_minimo !== undefined && (stockMinimo === null || stockMinimo < 0)) {
        return res.status(400).json({ success: false, error: 'El stock_minimo debe ser un número mayor o igual a cero.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const stockActualResult = await client.query(
            `SELECT stock_actual, stock_minimo
             FROM inventarios
             WHERE id_producto = $1 AND id_sucursal = $2
             FOR UPDATE`,
            [id_producto, id_sucursal]
        );

        const stockAnterior = stockActualResult.rows.length ? Number(stockActualResult.rows[0].stock_actual) : 0;
        const cantidadAjustada = stockObjetivo - stockAnterior;

        const stockResult = await client.query(
            `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual, stock_minimo)
             VALUES ($1, $2, $3, COALESCE($4, 0))
             ON CONFLICT (id_producto, id_sucursal)
             DO UPDATE SET
                 stock_actual = EXCLUDED.stock_actual,
                 stock_minimo = COALESCE($4, inventarios.stock_minimo)
             RETURNING stock_actual, stock_minimo`,
            [id_producto, id_sucursal, stockObjetivo, stockMinimo]
        );

        await client.query(
            `INSERT INTO ajustes_inventario (id_producto, id_sucursal, cantidad_ajustada, observacion, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [id_producto, id_sucursal, cantidadAjustada, observacion, id_usuario]
        );

        await client.query(
            `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario)
             VALUES ($1, $2, 'AJUSTE', $3, $4, NOW(), $5)`,
            [id_producto, id_sucursal, cantidadAjustada, stockObjetivo, id_usuario]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            mensaje: 'Stock del producto actualizado correctamente.',
            id_sucursal,
            stock_actual: Number(stockResult.rows[0].stock_actual),
            stock_minimo: Number(stockResult.rows[0].stock_minimo)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al fijar stock:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al actualizar el stock.' });
    } finally {
        client.release();
    }
};

module.exports = { getStockLocal, ajustarStock, fijarStockProducto };
