const express = require('express');
const router = express.Router();
const {
	getCategorias,
	getProveedores,
	getSucursales,
	getMetodosPago,
	crearCategoria,
	crearProveedor,
	actualizarCategoria,
	eliminarCategoria,
	actualizarProveedor,
	eliminarProveedor,
	actualizarMetodoPago,
	eliminarMetodoPago
} = require('../controllers/masterController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/categorias', verificarAuth, getCategorias);
router.post('/categorias', verificarAuth, crearCategoria); // Nueva ruta
router.put('/categorias/:id', verificarAuth, actualizarCategoria);
router.delete('/categorias/:id', verificarAuth, eliminarCategoria);

router.get('/proveedores', verificarAuth, getProveedores);
router.post('/proveedores', verificarAuth, crearProveedor); // Nueva ruta
router.put('/proveedores/:id', verificarAuth, actualizarProveedor);
router.delete('/proveedores/:id', verificarAuth, eliminarProveedor);

router.get('/sucursales', verificarAuth, getSucursales);
router.get('/metodos-pago', verificarAuth, getMetodosPago);
router.put('/metodos-pago/:id', verificarAuth, actualizarMetodoPago);
router.delete('/metodos-pago/:id', verificarAuth, eliminarMetodoPago);

module.exports = router;
