const express = require('express');
const router = express.Router();
const { registrarRetiro, getRetiros } = require('../controllers/withdrawalController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/', verificarAuth, getRetiros);
router.post('/', verificarAuth, registrarRetiro);

module.exports = router;
