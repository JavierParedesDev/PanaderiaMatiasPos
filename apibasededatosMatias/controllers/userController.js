const pool = require('../config/db');
const bcrypt = require('bcrypt'); // Librería para hashear contraseñas

// Crear un nuevo usuario (Solo Administradores)
const crearUsuario = async (req, res) => {
    // Seguridad: Verificamos que quien intenta crear el usuario sea el Administrador
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo los administradores pueden crear usuarios.' });
    }

    const { username, password, id_rol, id_sucursal } = req.body;

    try {
        // Encriptamos la contraseña (nadie podrá verla en la base de datos)
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO usuarios (username, password_hash, id_rol, id_sucursal, activo) 
             VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username`,
            [username, password_hash, id_rol, id_sucursal]
        );

        res.status(201).json({ success: true, mensaje: 'Usuario creado exitosamente', usuario: result.rows[0] });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        if (error.code === '23505') { // Código de error de PostgreSQL para "duplicado"
            return res.status(400).json({ success: false, error: 'El nombre de usuario ya existe.' });
        }
        res.status(500).json({ success: false, error: 'Error interno al crear el usuario.' });
    }
};

// Obtener la lista de usuarios
const getUsuarios = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    try {
        const result = await pool.query(`
            SELECT u.id, u.username, r.nombre as rol, s.nombre as sucursal, u.activo
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id
            JOIN sucursales s ON u.id_sucursal = s.id
            ORDER BY u.id ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ success: false, error: 'Error al obtener la lista de usuarios.' });
    }
};

// Actualizar un usuario
const actualizarUsuario = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { id } = req.params;
    const { username, password, id_rol, id_sucursal, activo } = req.body;

    try {
        let query = 'UPDATE usuarios SET username = $1, id_rol = $2, id_sucursal = $3, activo = $4';
        let values = [username, id_rol, id_sucursal, activo];
        
        if (password) {
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);
            query += ', password_hash = $5 WHERE id = $6 RETURNING id, username';
            values.push(password_hash, id);
        } else {
            query += ' WHERE id = $5 RETURNING id, username';
            values.push(id);
        }

        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ success: true, mensaje: 'Usuario actualizado exitosamente', usuario: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ success: false, error: 'Error interno al actualizar.' });
    }
};

// Eliminar un usuario
const eliminarUsuario = async (req, res) => {
    if (req.usuario.rol !== 'Admin') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ success: true, mensaje: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar el usuario.' });
    }
};

module.exports = { crearUsuario, getUsuarios, actualizarUsuario, eliminarUsuario };
