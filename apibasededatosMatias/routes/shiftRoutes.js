const express = require('express');
const router = express.Router();
const { abrirTurno, cerrarTurno, getTurnos } = require('../controllers/shiftController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/', verificarAuth, getTurnos);
router.post('/abrir', verificarAuth, abrirTurno);
router.post('/cerrar', verificarAuth, cerrarTurno);

module.exports = router;
