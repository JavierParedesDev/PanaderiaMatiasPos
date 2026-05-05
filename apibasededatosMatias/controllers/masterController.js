const pool = require('../config/db');

const sendMasterResponse = (req, res, rows) => {
    if (req.baseUrl === '/api') {
        return res.json(rows);
    }

    return res.json({ success: true, data: rows });
};

const getCategorias = async (req, res) => {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
    sendMasterResponse(req, res, result.rows);
};

const getProveedores = async (req, res) => {
    const result = await pool.query('SELECT * FROM proveedores ORDER BY nombre_empresa ASC');
    sendMasterResponse(req, res, result.rows);
};

const getSucursales = async (req, res) => {
    const result = await pool.query('SELECT id, nombre, direccion FROM sucursales ORDER BY id ASC');
    sendMasterResponse(req, res, result.rows);
};

const getMetodosPago = async (req, res) => {
    const result = await pool.query('SELECT * FROM metodos_pago ORDER BY id ASC');
    sendMasterResponse(req, res, result.rows);
};

// NUEVAS APIS: Crear Categor�as y Proveedores
const crearCategoria = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    try {
        const result = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING *', [req.body.nombre]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Error al crear categor�a.' }); }
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

const actualizarCategoria = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);
    const nombre = String(req.body.nombre || '').trim();

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Categoria invalida.' });
    }

    if (!nombre) {
        return res.status(400).json({ success: false, error: 'Debe indicar el nombre de la categoria.' });
    }

    try {
        const result = await pool.query('UPDATE categorias SET nombre = $1 WHERE id = $2 RETURNING *', [nombre, id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Categoria no encontrada.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23505' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || error.message || 'Error al actualizar categoria.' });
    }
};

const eliminarCategoria = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Categoria invalida.' });
    }

    try {
        const result = await pool.query('DELETE FROM categorias WHERE id = $1 RETURNING *', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Categoria no encontrada.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23503' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || 'No se puede eliminar la categoria porque tiene registros asociados.' });
    }
};

const actualizarProveedor = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);
    const { rut_proveedor, nombre_empresa, contacto_nombre, telefono } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Proveedor invalido.' });
    }

    if (!nombre_empresa || !String(nombre_empresa).trim()) {
        return res.status(400).json({ success: false, error: 'Debe indicar el nombre del proveedor.' });
    }

    try {
        const result = await pool.query(
            `UPDATE proveedores
             SET rut_proveedor = $1, nombre_empresa = $2, contacto_nombre = $3, telefono = $4
             WHERE id = $5
             RETURNING *`,
            [
                rut_proveedor || null,
                String(nombre_empresa).trim(),
                contacto_nombre || null,
                telefono || null,
                id
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Proveedor no encontrado.' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23505' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || error.message || 'Error al actualizar proveedor.' });
    }
};

const eliminarProveedor = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Proveedor invalido.' });
    }

    try {
        const result = await pool.query('DELETE FROM proveedores WHERE id = $1 RETURNING *', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Proveedor no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23503' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || 'No se puede eliminar el proveedor porque tiene registros asociados.' });
    }
};

const actualizarMetodoPago = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);
    const nombre = String(req.body.nombre || '').trim();

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Metodo de pago invalido.' });
    }

    if (!nombre) {
        return res.status(400).json({ success: false, error: 'Debe indicar el nombre del metodo de pago.' });
    }

    try {
        const result = await pool.query('UPDATE metodos_pago SET nombre = $1 WHERE id = $2 RETURNING *', [nombre, id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Metodo de pago no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23505' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || error.message || 'Error al actualizar metodo de pago.' });
    }
};

const eliminarMetodoPago = async (req, res) => {
    if (req.usuario.rol !== 'Admin') return res.status(403).json({ error: 'Solo Admin' });
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Metodo de pago invalido.' });
    }

    try {
        const result = await pool.query('DELETE FROM metodos_pago WHERE id = $1 RETURNING *', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Metodo de pago no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        const status = error.code === '23503' ? 400 : 500;
        res.status(status).json({ success: false, error: error.detail || 'No se puede eliminar el metodo de pago porque tiene registros asociados.' });
    }
};

module.exports = {
    getCategorias,
    getProveedores,
    getSucursales,
    getMetodosPago,
    crearCategoria,
    crearProveedor,
    actualizarCategoria,
    eliminarCategoria,
    actualizarProveedor,
    eliminarProveedor,
    actualizarMetodoPago,
    eliminarMetodoPago
};
