const express = require('express');
const router = express.Router();
const { abrirTurno, cerrarTurno, getTurnos, getResumenTurno } = require('../controllers/shiftController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/', verificarAuth, getTurnos);
router.get('/:id/resumen', verificarAuth, getResumenTurno);
router.post('/abrir', verificarAuth, abrirTurno);
router.post('/cerrar', verificarAuth, cerrarTurno);

module.exports = router;
