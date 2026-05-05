// kardexRoutes.js
const express = require('express');
const router = express.Router();
const { getTodosLosMovimientos } = require('../controllers/kardexController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/todos', verificarAuth, getTodosLosMovimientos);

module.exports = router;
