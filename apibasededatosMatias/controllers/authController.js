const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Debes enviar usuario y contrase�a.' });
    }

    try {
        const result = await pool.query(
            `SELECT u.*, r.nombre as rol
             FROM usuarios u
             JOIN roles r ON u.id_rol = r.id
             WHERE u.username = $1 AND u.activo = true`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo.' });
        }

        const user = result.rows[0];

        const passwordOk = await bcrypt.compare(password, user.password_hash);

        if (!passwordOk) {
            return res.status(401).json({ success: false, error: 'Contrase�a incorrecta.' });
        }

        const resolvedSucursalId = user.rol === 'Admin' ? user.id_sucursal : (user.id_sucursal || 1);

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                rol: user.rol,
                id_sucursal: resolvedSucursalId
            },
            process.env.JWT_SECRET || 'tu_clave_secreta_provisoria',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: user.id,
                username: user.username,
                rol: user.rol,
                id_sucursal: resolvedSucursalId
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: 'Error en el servidor.' });
    }
};

module.exports = { login };
