const express = require('express');
const router = express.Router();
const { getProductos, exportarProductosLabelNet, importarProductosLabelNet, crearProducto, actualizarProducto, eliminarProducto } = require('../controllers/productController');
const { verificarAuth } = require('../middlewares/authMiddleware');

router.get('/', verificarAuth, getProductos);
router.get('/export/labelnet', verificarAuth, exportarProductosLabelNet);
router.post('/import/labelnet', verificarAuth, importarProductosLabelNet);
router.post('/', verificarAuth, crearProducto);
router.put('/:id', verificarAuth, actualizarProducto);
router.delete('/:id', verificarAuth, eliminarProducto);

module.exports = router;
