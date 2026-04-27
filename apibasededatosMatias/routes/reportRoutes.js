const express = require('express');
const router = express.Router();
const {
    reporteCigarrosHoy,
    getDashboard,
    getRankingProductos,
    getReporteUtilidadMensual
} = require('../controllers/reportController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/cigarros', verificarAuth, reporteCigarrosHoy);
router.get('/dashboard', verificarAuth, getDashboard);
router.get('/ranking', verificarAuth, getRankingProductos);
router.get('/utilidad-mensual', verificarAuth, getReporteUtilidadMensual);

module.exports = router;
