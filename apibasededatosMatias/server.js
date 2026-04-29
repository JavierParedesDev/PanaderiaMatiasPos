const express = require('express');
const cors = require('cors');
// Si decides usar un archivo .env para las claves secretas más adelante
// const dotenv = require('dotenv'); 
// dotenv.config();

// 1. IMPORTACIÓN DE RUTAS
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const wastageRoutes = require('./routes/wastageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const userRoutes = require('./routes/userRoutes');
const masterRoutes = require('./routes/masterRoutes'); // <-- NUEVA IMPORTACIÓN (Maestros)
const kardexRoutes = require('./routes/kardexRoutes'); // <-- NUEVA IMPORTACIÓN (Auditoría)

const app = express();

// 2. MIDDLEWARES GLOBALES
// CORS permite que tu aplicación frontend se conecte desde otro dominio o IP
app.use(cors());
// Permite que la API reciba y entienda datos en formato JSON
app.use(express.json({ limit: '5mb' }));

// 3. RUTA DE VERIFICACIÓN (Health Check)
app.get('/', (req, res) => {
  res.json({ 
    mensaje: '✅ API Panadería Matias (Control Interno) funcionando correctamente!',
    fecha_servidor: new Date()
  });
});

// 4. DEFINICIÓN DE ENDPOINTS PÚBLICOS Y PRIVADOS
// Cada módulo tiene su propio prefijo de URL para mantener el orden
app.use('/api/auth', authRoutes);           // Manejo de Login y Tokens
app.use('/api/productos', productRoutes);   // Consulta y edición del catálogo de artículos
app.use('/api/ventas', saleRoutes);         // Procesamiento de ventas y transacciones
app.use('/api/turnos', shiftRoutes);        // Apertura, cierre y auditoría de caja
app.use('/api/facturas', invoiceRoutes);    // Ingreso de mercadería y actualización de stock
app.use('/api/mermas', wastageRoutes);      // Registro de pérdidas por daño o vencimiento
app.use('/api/reportes', reportRoutes);     // Reportes de gestión (Venta de cigarros, etc.)
app.use('/api/inventario', inventoryRoutes); // Consultas de stock local y ajustes manuales
app.use('/api/usuarios', userRoutes);       // Creación y listado de personal
app.use('/api/maestros', masterRoutes);     // Tablas maestras (Categorías, Sucursales, etc.)
app.use('/api/kardex', kardexRoutes);       // Historial completo de movimientos de inventario

// 5. MANEJO DE ERRORES PARA RUTAS NO EXISTENTES
app.use((req, res) => {
  res.status(404).json({ error: 'La ruta solicitada no existe en el servidor.' });
});

// 6. CONFIGURACIÓN DEL PUERTO Y ARRANQUE
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 Panadería Matias API operativa`);
  console.log(`📍 Puerto: ${PORT}`);
  console.log(`⏰ Inicio: ${new Date().toLocaleString()}`);
  console.log('==============================================');
});
