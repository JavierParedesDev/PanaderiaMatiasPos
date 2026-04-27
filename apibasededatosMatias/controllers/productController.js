const pool = require('../config/db');

/**
 * Obtener catálogo de productos
 * Incluye cálculos de utilidad y margen
 */
const getProductos = async (req, res) => {
    const id_sucursal = req.usuario.id_sucursal;

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
                COALESCE(i.stock_actual, 0) as stock_actual,
                -- Cálculo automático de utilidad
                (p.precio_venta - p.precio_costo) as utilidad_pesos,
                -- Cálculo automático de margen %
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
        res.json({ success: true, cantidad: result.rowCount, data: result.rows });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener el catálogo.' });
    }
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
        pesable
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO productos (
                codigo_interno, codigo_barra_externo, nombre, unidad, 
                precio_costo, precio_venta, id_categoria, impuesto_especifico, pesable
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                codigo_interno,
                codigo_barra_externo,
                nombre ? nombre.toUpperCase() : null,
                unidad,
                precio_costo || 0,
                precio_venta || 0,
                id_categoria,
                impuesto_especifico || 0,
                pesable === true || pesable === 'true' || pesable === 1
            ]
        );
        res.status(201).json({ success: true, mensaje: 'Producto creado exitosamente.', producto: result.rows[0] });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: 'Error al crear producto. Verifique si el código ya existe.' });
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
        pesable
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
                 pesable = $9
             WHERE id = $10 RETURNING *`,
            [
                codigo_interno,
                codigo_barra_externo,
                nombre ? nombre.toUpperCase() : null,
                unidad,
                precio_costo || 0,
                precio_venta || 0,
                id_categoria,
                activo,
                pesable === true || pesable === 'true' || pesable === 1,
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
        // Intento de eliminación física
        await pool.query('DELETE FROM productos WHERE id = $1', [id]);

        res.json({
            success: true,
            mensaje: 'Producto eliminado definitivamente de la base de datos.'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);

        // Si hay un error de clave foránea (el producto tiene ventas registradas)
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
    crearProducto,
    actualizarProducto,
    eliminarProducto
};
