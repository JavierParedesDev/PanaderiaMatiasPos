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

module.exports = { crearUsuario, getUsuarios };
