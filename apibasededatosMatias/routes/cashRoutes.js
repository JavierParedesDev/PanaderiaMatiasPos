const express = require('express');
const router = express.Router();
const {
    getCashStatus,
    openCash,
    closeCash,
    getCashWithdrawals,
    registerCashWithdrawal
} = require('../controllers/cashController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/estado', verificarAuth, getCashStatus);
router.post('/abrir', verificarAuth, openCash);
router.post('/cerrar', verificarAuth, closeCash);
router.get('/retiros', verificarAuth, getCashWithdrawals);
router.post('/retiro', verificarAuth, registerCashWithdrawal);

module.exports = router;
