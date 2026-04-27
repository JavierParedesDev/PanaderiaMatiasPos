const express = require('express');
const router = express.Router();
const { procesarVenta, getHistorialVentas } = require('../controllers/saleController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.post('/', verificarAuth, procesarVenta);
router.get('/historial', verificarAuth, getHistorialVentas); // Nueva ruta conectada

module.exports = router;
