const express = require('express');
const router = express.Router();
const { ingresarFactura } = require('../controllers/invoiceController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.post('/', verificarAuth, ingresarFactura);

module.exports = router;
