const express = require('express');
const router = express.Router();
const { crearUsuario, getUsuarios } = require('../controllers/userController');
const { verificarAuth } = require('../middlewares/authMiddleware');

// Ruta POST: Para crear un usuario (Ej: /api/usuarios)
router.post('/', verificarAuth, crearUsuario);

// Ruta GET: Para ver la lista de usuarios
router.get('/', verificarAuth, getUsuarios);

module.exports = router;
