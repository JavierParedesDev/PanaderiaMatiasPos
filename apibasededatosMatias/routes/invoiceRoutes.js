const express = require('express');
const router = express.Router();
const { ingresarFactura, getFacturasIngreso } = require('../controllers/invoiceController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/', verificarAuth, getFacturasIngreso);
router.post('/', verificarAuth, ingresarFactura);

module.exports = router;
