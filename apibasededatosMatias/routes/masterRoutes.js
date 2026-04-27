const express = require('express');
const router = express.Router();
const { getCategorias, getProveedores, getSucursales, getMetodosPago, crearCategoria, crearProveedor } = require('../controllers/masterController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/categorias', verificarAuth, getCategorias);
router.post('/categorias', verificarAuth, crearCategoria); // Nueva ruta

router.get('/proveedores', verificarAuth, getProveedores);
router.post('/proveedores', verificarAuth, crearProveedor); // Nueva ruta

router.get('/sucursales', verificarAuth, getSucursales);
router.get('/metodos-pago', verificarAuth, getMetodosPago);

module.exports = router;
