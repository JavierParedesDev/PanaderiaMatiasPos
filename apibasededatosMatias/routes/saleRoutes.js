const express = require('express');
const router = express.Router();
const { procesarVenta, getHistorialVentas, getDetalleVenta, anularVenta } = require('../controllers/saleController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.post('/', verificarAuth, procesarVenta);
router.get('/', verificarAuth, getHistorialVentas);
router.get('/historial', verificarAuth, getHistorialVentas);
router.put('/:id/anular', verificarAuth, anularVenta);
router.get('/:id', verificarAuth, getDetalleVenta);

module.exports = router;

