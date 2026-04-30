const express = require('express');
const router = express.Router();
const {
    getTrabajadores,
    crearTrabajador,
    registrarConsumo,
    getConsumos,
    registrarPago
} = require('../controllers/staffConsumptionController');
const { verificarAuth, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/trabajadores', verificarAuth, getTrabajadores);
router.post('/trabajadores', verificarAuth, requireAdmin, crearTrabajador);
router.get('/', verificarAuth, requireAdmin, getConsumos);
router.post('/', verificarAuth, registrarConsumo);
router.post('/trabajadores/:id_trabajador/pagos', verificarAuth, requireAdmin, registrarPago);

module.exports = router;
