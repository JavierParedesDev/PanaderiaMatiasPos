const express = require('express');
const router = express.Router();
const {
    getTrabajadores,
    crearTrabajador,
    actualizarTrabajador,
    eliminarTrabajador,
    registrarConsumo,
    getConsumos,
    registrarPago
} = require('../controllers/staffConsumptionController');
const { verificarAuth, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/trabajadores', verificarAuth, getTrabajadores);
router.post('/trabajadores', verificarAuth, requireAdmin, crearTrabajador);
router.put('/trabajadores/:id_trabajador', verificarAuth, requireAdmin, actualizarTrabajador);
router.delete('/trabajadores/:id_trabajador', verificarAuth, requireAdmin, eliminarTrabajador);
router.get('/', verificarAuth, requireAdmin, getConsumos);
router.post('/', verificarAuth, registrarConsumo);
router.post('/trabajadores/:id_trabajador/pagos', verificarAuth, requireAdmin, registrarPago);

module.exports = router;
