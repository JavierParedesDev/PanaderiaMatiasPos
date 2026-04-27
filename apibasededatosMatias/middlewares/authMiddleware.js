const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_provisoria';

const verificarAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(403).json({ error: 'Acceso denegado. No se proporciono token.' });
    }

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'Formato de token invalido.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ error: 'Formato de token invalido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token invalido o expirado. Inicie sesion nuevamente.' });
        }

        req.usuario = decoded;
        next();
    });
};

module.exports = { verificarAuth };
