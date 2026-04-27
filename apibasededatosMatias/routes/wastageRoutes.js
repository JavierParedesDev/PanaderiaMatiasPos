const express = require('express');
const router = express.Router();
const { registrarMerma } = require('../controllers/wastageController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.post('/', verificarAuth, registrarMerma);

module.exports = router;
