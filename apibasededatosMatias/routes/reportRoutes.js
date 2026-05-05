const express = require('express');
const router = express.Router();
const { 
    reporteCigarrosHoy, 
    getDashboard, 
    getRankingProductos, 
    getReporteUtilidadMensual,
    getKpisDiarios,
    getVentasPorSucursal,
    getHistoricoVentas,
    getVentasPorTurno
} = require('../controllers/reportController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/cigarros', verificarAuth, reporteCigarrosHoy);
router.get('/dashboard', verificarAuth, getDashboard);
router.get('/ranking', verificarAuth, getRankingProductos);
router.get('/utilidad-mensual', verificarAuth, getReporteUtilidadMensual);
router.get('/kpis-diarios', verificarAuth, getKpisDiarios);
router.get('/ventas-por-sucursal', verificarAuth, getVentasPorSucursal);
router.get('/historico-ventas', verificarAuth, getHistoricoVentas);
router.get('/ventas-por-turno', verificarAuth, getVentasPorTurno);

module.exports = router;

