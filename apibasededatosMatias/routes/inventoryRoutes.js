const express = require('express');
const router = express.Router();
const { getStockLocal, ajustarStock } = require('../controllers/inventoryController');
const { verificarAuth } = require('../middlewares/authMiddleware');

// Ruta GET: Ver stock actual de la sucursal (Ej: /api/inventario)
router.get('/', verificarAuth, getStockLocal);

// Ruta POST: Hacer un ajuste manual (Ej: /api/inventario/ajuste)
router.post('/ajuste', verificarAuth, ajustarStock);

module.exports = router;
