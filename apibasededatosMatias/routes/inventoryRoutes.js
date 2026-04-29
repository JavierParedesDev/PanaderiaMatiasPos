const express = require('express');
const router = express.Router();
const { getStockLocal, ajustarStock, fijarStockProducto } = require('../controllers/inventoryController');
const { verificarAuth, requireAdmin } = require('../middlewares/authMiddleware');

// Ruta GET: Ver stock actual de la sucursal (Ej: /api/inventario)
router.get('/', verificarAuth, getStockLocal);

// Ruta POST: Hacer un ajuste manual (Ej: /api/inventario/ajuste)
router.post('/ajuste', verificarAuth, requireAdmin, ajustarStock);

// Ruta PUT: Fijar stock absoluto de un producto en una sucursal
router.put('/:id_producto', verificarAuth, requireAdmin, fijarStockProducto);

module.exports = router;
