const express = require('express');
const router = express.Router();
const { getHistorialProducto, getTodosLosMovimientos } = require('../controllers/kardexController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/todos', verificarAuth, getTodosLosMovimientos);
router.get('/producto/:id_producto/:id_sucursal', verificarAuth, getHistorialProducto);

module.exports = router;
