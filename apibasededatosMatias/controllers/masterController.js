const pool = require('../config/db');

const getCategorias = async (req, res) => {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
    res.json({ success: true, data: result.rows });
};

const getProveedores = async (req, res) => {
    const result = await pool.query('SELECT * FROM proveedores ORDER BY nombre_empresa ASC');
    res.json({ success: true, data: result.rows });
};

const getSucursales = async (req, res) => {
    const result = await pool.query('SELECT id, nombre, direccion FROM sucursales ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
};

const getMetodosPago = async (req, res) => {
    const result = await pool.query('SELECT * FROM metodos_pago ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
};

// NUEVAS APIS: Crear Categorías y Proveedores
const crearCategoria = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    try {
        const result = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING *', [req.body.nombre]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Error al crear categoría.' }); }
};

const crearProveedor = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const { rut_proveedor, nombre_empresa, contacto_nombre, telefono } = req.body;

    if (!nombre_empresa || !String(nombre_empresa).trim()) {
        return res.status(400).json({ success: false, error: 'Debe indicar el nombre del proveedor.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO proveedores (rut_proveedor, nombre_empresa, contacto_nombre, telefono) VALUES ($1, $2, $3, $4) RETURNING *', 
            [
                rut_proveedor || null,
                String(nombre_empresa).trim(),
                contacto_nombre || null,
                telefono || null
            ]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23505' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || error.message || 'Error al crear proveedor.' });
    }
};

module.exports = { getCategorias, getProveedores, getSucursales, getMetodosPago, crearCategoria, crearProveedor };
