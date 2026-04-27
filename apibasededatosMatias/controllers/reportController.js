const pool = require('../config/db');

/**
 * Reporte específico de Cigarros (día actual)
 */
const reporteCigarrosHoy = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.nombre AS producto, SUM(vd.cantidad) AS unidades_vendidas, SUM(vd.subtotal) AS total_recaudado
            FROM ventas_detalle vd 
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id 
            JOIN productos p ON vd.id_producto = p.id 
            JOIN categorias c ON p.id_categoria = c.id
            WHERE c.nombre = 'Cigarros' AND DATE(vc.fecha) = CURRENT_DATE 
            GROUP BY p.nombre
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en reporte de cigarros.' });
    }
};

/**
 * Dashboard principal mejorado con KPIs ejecutivos
 */
const getDashboard = async (req, res) => {
    try {
        const statsVentas = await pool.query(`
            SELECT COALESCE(SUM(total_venta), 0) as total, COUNT(*) as transacciones
            FROM ventas_cabecera WHERE DATE(fecha) = CURRENT_DATE
        `);
        const utilidadHoy = await pool.query(`
            SELECT COALESCE(SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad), 0) as utilidad
            FROM ventas_detalle vd
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id
            JOIN productos p ON vd.id_producto = p.id
            WHERE DATE(vc.fecha) = CURRENT_DATE
        `);
        const stockCritico = await pool.query(`
            SELECT p.nombre, i.stock_actual, i.stock_minimo, p.unidad
            FROM inventarios i JOIN productos p ON i.id_producto = p.id
            WHERE i.stock_actual <= i.stock_minimo LIMIT 5
        `);
        const stockCriticoCount = await pool.query("SELECT COUNT(*) as cantidad FROM inventarios WHERE stock_actual <= stock_minimo");
        const ultimasVentas = await pool.query(`SELECT id, total_venta, fecha, id_usuario FROM ventas_cabecera ORDER BY fecha DESC LIMIT 5`);
        const ventasSemana = await pool.query(`
            SELECT DATE(fecha) as dia, SUM(total_venta) as total
            FROM ventas_cabecera WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY DATE(fecha) ORDER BY dia ASC
        `);

        res.json({
            success: true,
            data: {
                kpis: {
                    ventasTotales: parseFloat(statsVentas.rows[0].total),
                    transacciones: parseInt(statsVentas.rows[0].transacciones),
                    utilidadEstimada: parseFloat(utilidadHoy.rows[0].utilidad)
                },
                alertasStock: { total: parseInt(stockCriticoCount.rows[0].cantidad), items: stockCritico.rows },
                ultimasVentas: ultimasVentas.rows,
                graficoVentas: ventasSemana.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cargar el Dashboard.' });
    }
};

/**
 * Ranking de productos (Top 10 más vendidos y rentables)
 */
const getRankingProductos = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.nombre, 
                SUM(vd.cantidad) as total_unidades,
                SUM(vd.subtotal) as total_venta,
                SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad) as total_utilidad
            FROM ventas_detalle vd
            JOIN productos p ON vd.id_producto = p.id
            GROUP BY p.nombre
            ORDER BY total_unidades DESC
            LIMIT 10
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener ranking.' });
    }
};

/**
 * Resumen Mensual de Utilidades (Historial 6 meses)
 */
const getReporteUtilidadMensual = async (req, res) => {
    try {
        const query = `
            SELECT 
                TO_CHAR(vc.fecha, 'YYYY-MM') as mes,
                SUM(vc.total_venta) as venta_total,
                SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad) as utilidad_total
            FROM ventas_cabecera vc
            JOIN ventas_detalle vd ON vc.id = vd.id_venta
            JOIN productos p ON vd.id_producto = p.id
            GROUP BY TO_CHAR(vc.fecha, 'YYYY-MM')
            ORDER BY mes DESC
            LIMIT 6
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener reporte mensual.' });
    }
};

module.exports = { reporteCigarrosHoy, getDashboard, getRankingProductos, getReporteUtilidadMensual };
