const express = require('express');
const router = express.Router();
const { crearUsuario, getUsuarios, actualizarUsuario, eliminarUsuario } = require('../controllers/userController');
const { verificarAuth } = require('../middlewares/authMiddleware');

// Ruta POST: Para crear un usuario (Ej: /api/usuarios)
router.post('/', verificarAuth, crearUsuario);

// Ruta GET: Para ver la lista de usuarios
router.get('/', verificarAuth, getUsuarios);

// Ruta PUT: Para actualizar un usuario
router.put('/:id', verificarAuth, actualizarUsuario);

// Ruta DELETE: Para eliminar un usuario
router.delete('/:id', verificarAuth, eliminarUsuario);

module.exports = router;
