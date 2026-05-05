const pool = require('../config/db');

const resolveSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    return req.usuario.id_sucursal;
};

const resolveReportSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal);
    if (req.usuario?.rol === 'Admin') {
        return Number.isInteger(requested) && requested > 0 ? requested : null;
    }

    return req.usuario.id_sucursal;
};

const VALID_INTERVALS = new Set(['dia', 'semana', 'mes', 'anio']);

const toNumber = (value) => {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getHistoryPeriodExpression = (intervalo) => {
    if (intervalo === 'semana') return `TO_CHAR(vc.fecha::date, 'IYYY-IW')`;
    if (intervalo === 'mes') return `TO_CHAR(vc.fecha::date, 'YYYY-MM')`;
    if (intervalo === 'anio') return `TO_CHAR(vc.fecha::date, 'YYYY')`;
    return `TO_CHAR(vc.fecha::date, 'YYYY-MM-DD')`;
};

const getSaleGainSubquery = () => `
    SELECT
        vd.id_venta,
        SUM(COALESCE(vd.precio_unitario, 0) * COALESCE(vd.cantidad, 0)) - SUM(COALESCE(p.precio_costo, 0) * COALESCE(vd.cantidad, 0)) AS ganancia_neta,
        SUM(COALESCE(p.precio_costo, 0) * COALESCE(vd.cantidad, 0)) AS costo_total
    FROM ventas_detalle vd
    LEFT JOIN productos p ON p.id = vd.id_producto
    GROUP BY vd.id_venta
`;

const normalizePaymentBucket = (methodName = '') => {
    const metodo = String(methodName || '').toLowerCase();
    if (metodo.includes('transfe')) return 'transferencia';
    if (metodo.includes('tarjeta') || metodo.includes('debito') || metodo.includes('credito') || metodo.includes('cr�dito')) return 'tarjeta';
    return 'efectivo';
};

/**
 * Reporte espec�fico de Cigarros (d�a actual o por turno)
 */
const reporteCigarrosHoy = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);
    const id_turno = Number(req.query.id_turno);
    const idTurnoFiltro = Number.isInteger(id_turno) && id_turno > 0 ? id_turno : null;
        const tipo_turno = req.query.tipo_turno ? String(req.query.tipo_turno) : null;
        const tipoTurnoFiltro = tipo_turno && tipo_turno.trim() ? tipo_turno.trim() : null;

    try {
        const result = await pool.query(
            `
            SELECT p.nombre AS producto, SUM(vd.cantidad) AS unidades_vendidas, SUM(vd.subtotal) AS total_recaudado
            FROM ventas_detalle vd
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id
                        LEFT JOIN turnos_caja t ON t.id = vc.id_turno
            JOIN productos p ON vd.id_producto = p.id
            JOIN categorias c ON p.id_categoria = c.id
            WHERE c.nombre = 'Cigarros'
              AND vc.id_sucursal = $1
              AND (
                ($2::int IS NULL AND DATE(vc.fecha) = CURRENT_DATE)
                OR ($2::int IS NOT NULL AND vc.id_turno = $2)
              )
                            AND (
                                $2::int IS NOT NULL
                                OR $3::text IS NULL
                                OR t.tipo_turno = $3
                                OR (
                                    ($3 = 'Unico' OR $3 = 'Único') AND (t.tipo_turno = 'Unico' OR t.tipo_turno = 'Único')
                                )
                            )
            GROUP BY p.nombre
        `,
                        [id_sucursal, idTurnoFiltro, tipoTurnoFiltro]
        );
                res.json({ success: true, id_sucursal, id_turno: idTurnoFiltro, tipo_turno: tipoTurnoFiltro, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en reporte de cigarros.' });
    }
};

/**
 * Dashboard principal mejorado con KPIs ejecutivos
 */
const getDashboard = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const statsVentas = await pool.query(
            `
            SELECT COALESCE(SUM(total_venta), 0) as total, COUNT(*) as transacciones
            FROM ventas_cabecera
            WHERE DATE(fecha) = CURRENT_DATE AND id_sucursal = $1
        `,
            [id_sucursal]
        );
        const statsVentasMes = await pool.query(
            `
            SELECT COALESCE(SUM(total_venta), 0) as total, COUNT(*) as transacciones
            FROM ventas_cabecera
            WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
              AND id_sucursal = $1
        `,
            [id_sucursal]
        );
        const utilidadHoy = await pool.query(
            `
            SELECT COALESCE(SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad), 0) as utilidad
            FROM ventas_detalle vd
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id
            JOIN productos p ON vd.id_producto = p.id
            WHERE DATE(vc.fecha) = CURRENT_DATE AND vc.id_sucursal = $1
        `,
            [id_sucursal]
        );
        const utilidadMes = await pool.query(
            `
            SELECT COALESCE(SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad), 0) as utilidad
            FROM ventas_detalle vd
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id
            JOIN productos p ON vd.id_producto = p.id
            WHERE DATE_TRUNC('month', vc.fecha) = DATE_TRUNC('month', CURRENT_DATE)
              AND vc.id_sucursal = $1
        `,
            [id_sucursal]
        );
        const stockCritico = await pool.query(
            `
            SELECT p.nombre, i.stock_actual, i.stock_minimo, p.unidad
            FROM inventarios i
            JOIN productos p ON i.id_producto = p.id
            WHERE i.id_sucursal = $1 AND i.stock_actual <= i.stock_minimo
            ORDER BY i.stock_actual ASC, p.nombre ASC
            LIMIT 5
        `,
            [id_sucursal]
        );
        const stockCriticoCount = await pool.query(
            `
            SELECT COUNT(*) as cantidad
            FROM inventarios
            WHERE id_sucursal = $1 AND stock_actual <= stock_minimo
        `,
            [id_sucursal]
        );
        const ultimasVentas = await pool.query(
            `
            SELECT id, total_venta, fecha, id_usuario
            FROM ventas_cabecera
            WHERE id_sucursal = $1
            ORDER BY fecha DESC
            LIMIT 5
        `,
            [id_sucursal]
        );
        const ventasSemana = await pool.query(
            `
            SELECT DATE(fecha) as dia, SUM(total_venta) as total
            FROM ventas_cabecera
            WHERE fecha >= CURRENT_DATE - INTERVAL '6 days' AND id_sucursal = $1
            GROUP BY DATE(fecha)
            ORDER BY dia ASC
        `,
            [id_sucursal]
        );
        const ventasMes = await pool.query(
            `
            SELECT DATE(fecha) as dia, SUM(total_venta) as total
            FROM ventas_cabecera
            WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
              AND id_sucursal = $1
            GROUP BY DATE(fecha)
            ORDER BY dia ASC
        `,
            [id_sucursal]
        );

        res.json({
            success: true,
            id_sucursal,
            data: {
                kpis: {
                    ventasTotales: parseFloat(statsVentas.rows[0].total),
                    transacciones: parseInt(statsVentas.rows[0].transacciones, 10),
                    utilidadEstimada: parseFloat(utilidadHoy.rows[0].utilidad),
                    ventasMensuales: parseFloat(statsVentasMes.rows[0].total),
                    transaccionesMensuales: parseInt(statsVentasMes.rows[0].transacciones, 10),
                    utilidadMensual: parseFloat(utilidadMes.rows[0].utilidad)
                },
                alertasStock: { total: parseInt(stockCriticoCount.rows[0].cantidad, 10), items: stockCritico.rows },
                ultimasVentas: ultimasVentas.rows,
                graficoVentas: ventasSemana.rows,
                graficoMensual: ventasMes.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cargar el Dashboard.' });
    }
};

/**
 * Ranking de productos (Top 10 m�s vendidos y rentables)
 */
const getRankingProductos = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const query = `
            SELECT
                p.nombre,
                SUM(vd.cantidad) as total_unidades,
                SUM(vd.subtotal) as total_venta,
                SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad) as total_utilidad
            FROM ventas_detalle vd
            JOIN ventas_cabecera vc ON vd.id_venta = vc.id
            JOIN productos p ON vd.id_producto = p.id
            WHERE vc.id_sucursal = $1
            GROUP BY p.nombre
            ORDER BY total_unidades DESC
            LIMIT 10
        `;
        const result = await pool.query(query, [id_sucursal]);
        res.json({ success: true, id_sucursal, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener ranking.' });
    }
};

/**
 * Resumen Mensual de Utilidades (Historial 6 meses)
 */
const getReporteUtilidadMensual = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);

    try {
        const query = `
            SELECT
                TO_CHAR(vc.fecha, 'YYYY-MM') as mes,
                SUM(vc.total_venta) as venta_total,
                SUM((vd.precio_unitario - p.precio_costo) * vd.cantidad) as utilidad_total
            FROM ventas_cabecera vc
            JOIN ventas_detalle vd ON vc.id = vd.id_venta
            JOIN productos p ON vd.id_producto = p.id
            WHERE vc.id_sucursal = $1
            GROUP BY TO_CHAR(vc.fecha, 'YYYY-MM')
            ORDER BY mes DESC
            LIMIT 6
        `;
        const result = await pool.query(query, [id_sucursal]);
        res.json({ success: true, id_sucursal, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener reporte mensual.' });
    }
};

const getKpisDiarios = async (req, res) => {
    const id_sucursal = resolveReportSucursalId(req);

    try {
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(vc.total_venta), 0) AS total_ventas,
                COUNT(vc.id)::int AS transacciones,
                COALESCE(SUM(g.ganancia_neta), 0) AS ganancia_neta
             FROM ventas_cabecera vc
             LEFT JOIN (${getSaleGainSubquery()}) g ON g.id_venta = vc.id
             WHERE vc.fecha::date = CURRENT_DATE
               AND ($1::int IS NULL OR vc.id_sucursal = $1)`,
            [id_sucursal]
        );

        const row = result.rows[0] || {};
        const totalVentas = toNumber(row.total_ventas);
        const gananciaNeta = toNumber(row.ganancia_neta);

        res.json({
            success: true,
            data: {
                ventasSII: totalVentas,
                ventasInternas: 0,
                gananciaNeta,
                transacciones: toNumber(row.transacciones),
                caja: {
                    ventasSII: totalVentas,
                    ventasInternas: 0,
                    gananciaNeta
                },
                despacho: {
                    ventasSII: 0,
                    ventasInternas: 0,
                    gananciaNeta: 0
                }
            }
        });
    } catch (error) {
        console.error('Error KPIs diarios:', error);
        res.status(500).json({ success: false, error: 'Error al obtener KPIs diarios.' });
    }
};

const getVentasPorSucursal = async (req, res) => {
    const id_sucursal = resolveReportSucursalId(req);

    try {
        const result = await pool.query(
            `SELECT
                s.id AS id_sucursal,
                s.nombre AS "nombreSucursal",
                COALESCE(SUM(vc.total_venta), 0) AS "ventasSII",
                0 AS "ventasInternas",
                COALESCE(SUM(g.ganancia_neta), 0) AS "gananciaNeta",
                COALESCE(SUM(vc.total_venta), 0) AS "ventasCaja",
                0 AS "ventasDespacho",
                COALESCE(SUM(vc.total_venta), 0) AS "ventasSIICaja",
                0 AS "ventasInternasCaja",
                0 AS "ventasSIIDespacho",
                0 AS "ventasInternasDespacho",
                COALESCE(SUM(g.ganancia_neta), 0) AS "gananciaCaja",
                0 AS "gananciaDespacho"
             FROM sucursales s
             LEFT JOIN ventas_cabecera vc
                ON vc.id_sucursal = s.id
               AND vc.fecha::date = CURRENT_DATE
             LEFT JOIN (${getSaleGainSubquery()}) g ON g.id_venta = vc.id
             WHERE ($1::int IS NULL OR s.id = $1)
             GROUP BY s.id, s.nombre
             ORDER BY s.id ASC`,
            [id_sucursal]
        );

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error ventas por sucursal:', error);
        res.status(500).json({ success: false, error: 'Error al obtener ventas por sucursal.' });
    }
};

const getHistoricoVentas = async (req, res) => {
    const id_sucursal = resolveReportSucursalId(req);
    const intervalo = VALID_INTERVALS.has(req.query.intervalo) ? req.query.intervalo : 'dia';
    const periodExpression = getHistoryPeriodExpression(intervalo);

    try {
        const result = await pool.query(
            `SELECT
                ${periodExpression} AS periodo,
                COALESCE(SUM(vc.total_venta), 0) AS "totalVentas",
                COALESCE(SUM(vc.total_venta), 0) AS "ventasSII",
                0 AS "ventasInternas",
                COALESCE(SUM(vc.total_venta), 0) AS "ventasCaja",
                0 AS "ventasDespacho",
                COALESCE(SUM(g.ganancia_neta), 0) AS "gananciaCaja",
                0 AS "gananciaDespacho",
                COALESCE(SUM(g.ganancia_neta), 0) AS "gananciaNeta"
             FROM ventas_cabecera vc
             LEFT JOIN (${getSaleGainSubquery()}) g ON g.id_venta = vc.id
             WHERE vc.fecha >= CURRENT_DATE - INTERVAL '18 months'
               AND ($1::int IS NULL OR vc.id_sucursal = $1)
             GROUP BY periodo
             ORDER BY periodo ASC`,
            [id_sucursal]
        );

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error historico ventas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener historico de ventas.' });
    }
};

const getVentasPorTurno = async (req, res) => {
    const id_sucursal = resolveReportSucursalId(req);
    const onlyToday = req.query.hoy !== 'false';

    try {
        const result = await pool.query(
            `SELECT
                t.id AS id_turno,
                t.tipo_turno,
                t.estado,
                t.fecha_apertura,
                t.fecha_cierre,
                t.monto_apertura,
                t.id_usuario,
                t.id_sucursal,
                COALESCE(u.username, CONCAT('Usuario ', t.id_usuario)) AS nombre_usuario,
                COALESCE(s.nombre, CONCAT('Sucursal ', t.id_sucursal)) AS nombre_sucursal,
                COALESCE(mp.nombre, 'Efectivo') AS metodo_pago,
                COALESCE(SUM(vp.monto_pagado), 0) AS total
             FROM turnos_caja t
             LEFT JOIN usuarios u ON u.id = t.id_usuario
             LEFT JOIN sucursales s ON s.id = t.id_sucursal
             LEFT JOIN ventas_cabecera vc ON vc.id_turno = t.id
             LEFT JOIN ventas_pagos vp ON vp.id_venta = vc.id
             LEFT JOIN metodos_pago mp ON mp.id = vp.id_metodo_pago
             WHERE ($1::int IS NULL OR t.id_sucursal = $1)
               AND ($2::boolean = FALSE OR t.fecha_apertura::date = CURRENT_DATE OR vc.fecha::date = CURRENT_DATE)
             GROUP BY t.id, u.username, s.nombre, mp.nombre
             ORDER BY t.fecha_apertura DESC, t.id DESC`,
            [id_sucursal, onlyToday]
        );

        const byShift = new Map();
        result.rows.forEach((row) => {
            const key = Number(row.id_turno);
            if (!byShift.has(key)) {
                byShift.set(key, {
                    id_turno: key,
                    tipo_turno: row.tipo_turno,
                    estado: row.estado,
                    fecha_apertura: row.fecha_apertura,
                    fecha_cierre: row.fecha_cierre,
                    monto_apertura: toNumber(row.monto_apertura),
                    id_usuario: row.id_usuario,
                    id_sucursal: row.id_sucursal,
                    nombre_usuario: row.nombre_usuario,
                    nombre_sucursal: row.nombre_sucursal,
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    total: 0
                });
            }

            const turno = byShift.get(key);
            const bucket = normalizePaymentBucket(row.metodo_pago);
            const total = toNumber(row.total);
            turno[bucket] += total;
            turno.total += total;
        });

        res.json({ success: true, data: Array.from(byShift.values()) });
    } catch (error) {
        console.error('Error ventas por turno:', error);
        res.status(500).json({ success: false, error: 'Error al obtener ventas por turno.' });
    }
};

const getMetricasFinancieras = async (req, res) => {
    const id_sucursal = resolveReportSucursalId(req);

    try {
        const params = [id_sucursal];

        const resumenResult = await pool.query(
            `WITH venta_finanzas AS (
                SELECT
                    vc.id,
                    vc.fecha,
                    vc.total_venta,
                    COALESCE(SUM(COALESCE(p.precio_costo, 0) * COALESCE(vd.cantidad, 0)), 0) AS costo_total,
                    COALESCE(SUM((COALESCE(vd.precio_unitario, 0) - COALESCE(p.precio_costo, 0)) * COALESCE(vd.cantidad, 0)), 0) AS ganancia
                FROM ventas_cabecera vc
                LEFT JOIN ventas_detalle vd ON vd.id_venta = vc.id
                LEFT JOIN productos p ON p.id = vd.id_producto
                WHERE vc.fecha >= date_trunc('month', CURRENT_DATE)
                  AND ($1::int IS NULL OR vc.id_sucursal = $1)
                GROUP BY vc.id
             )
             SELECT
                COALESCE(SUM(total_venta), 0) AS venta_total,
                COALESCE(SUM(costo_total), 0) AS costo_total,
                COALESCE(SUM(ganancia), 0) AS ganancia_total,
                COUNT(*)::int AS transacciones,
                CASE WHEN COALESCE(SUM(total_venta), 0) > 0
                    THEN ROUND((COALESCE(SUM(ganancia), 0) / COALESCE(SUM(total_venta), 0)) * 100, 2)
                    ELSE 0
                END AS margen_porcentaje
             FROM venta_finanzas`,
            params
        );

        const semanalResult = await pool.query(
            `WITH dias AS (
                SELECT generate_series(
                    date_trunc('week', CURRENT_DATE)::date,
                    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days')::date,
                    INTERVAL '1 day'
                )::date AS fecha
             ),
             venta_finanzas AS (
                SELECT
                    vc.id,
                    vc.fecha::date AS fecha,
                    vc.total_venta,
                    COALESCE(SUM(COALESCE(p.precio_costo, 0) * COALESCE(vd.cantidad, 0)), 0) AS costo_total,
                    COALESCE(SUM((COALESCE(vd.precio_unitario, 0) - COALESCE(p.precio_costo, 0)) * COALESCE(vd.cantidad, 0)), 0) AS ganancia
                FROM ventas_cabecera vc
                LEFT JOIN ventas_detalle vd ON vd.id_venta = vc.id
                LEFT JOIN productos p ON p.id = vd.id_producto
                WHERE vc.fecha::date BETWEEN date_trunc('week', CURRENT_DATE)::date
                  AND (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days')::date
                  AND ($1::int IS NULL OR vc.id_sucursal = $1)
                GROUP BY vc.id
             )
             SELECT
                d.fecha,
                COALESCE(SUM(v.total_venta), 0) AS venta_total,
                COALESCE(SUM(v.costo_total), 0) AS costo_total,
                COALESCE(SUM(v.ganancia), 0) AS ganancia_total,
                COUNT(v.id)::int AS transacciones
             FROM dias d
             LEFT JOIN venta_finanzas v ON v.fecha = d.fecha
             GROUP BY d.fecha
             ORDER BY d.fecha ASC`,
            params
        );

        const mensualResult = await pool.query(
            `WITH meses AS (
                SELECT generate_series(
                    date_trunc('year', CURRENT_DATE)::date,
                    (date_trunc('year', CURRENT_DATE)::date + INTERVAL '11 months')::date,
                    INTERVAL '1 month'
                )::date AS mes
             ),
             venta_finanzas AS (
                SELECT
                    vc.id,
                    date_trunc('month', vc.fecha)::date AS mes,
                    vc.total_venta,
                    COALESCE(SUM(COALESCE(p.precio_costo, 0) * COALESCE(vd.cantidad, 0)), 0) AS costo_total,
                    COALESCE(SUM((COALESCE(vd.precio_unitario, 0) - COALESCE(p.precio_costo, 0)) * COALESCE(vd.cantidad, 0)), 0) AS ganancia
                FROM ventas_cabecera vc
                LEFT JOIN ventas_detalle vd ON vd.id_venta = vc.id
                LEFT JOIN productos p ON p.id = vd.id_producto
                WHERE vc.fecha >= date_trunc('year', CURRENT_DATE)
                  AND vc.fecha < date_trunc('year', CURRENT_DATE) + INTERVAL '1 year'
                  AND ($1::int IS NULL OR vc.id_sucursal = $1)
                GROUP BY vc.id
             )
             SELECT
                m.mes,
                COALESCE(SUM(v.total_venta), 0) AS venta_total,
                COALESCE(SUM(v.costo_total), 0) AS costo_total,
                COALESCE(SUM(v.ganancia), 0) AS ganancia_total,
                COUNT(v.id)::int AS transacciones
             FROM meses m
             LEFT JOIN venta_finanzas v ON v.mes = m.mes
             GROUP BY m.mes
             ORDER BY m.mes ASC`,
            params
        );

        const pagosResult = await pool.query(
            `SELECT
                COALESCE(mp.nombre, 'Efectivo') AS metodo,
                COALESCE(SUM(vp.monto_pagado), 0) AS total
             FROM ventas_pagos vp
             JOIN ventas_cabecera vc ON vc.id = vp.id_venta
             LEFT JOIN metodos_pago mp ON mp.id = vp.id_metodo_pago
             WHERE vc.fecha >= date_trunc('month', CURRENT_DATE)
               AND ($1::int IS NULL OR vc.id_sucursal = $1)
             GROUP BY mp.nombre
             ORDER BY total DESC`,
            params
        );

        const productosResult = await pool.query(
            `SELECT
                p.nombre,
                COALESCE(SUM(vd.cantidad), 0) AS unidades,
                COALESCE(SUM(vd.subtotal), 0) AS venta_total,
                COALESCE(SUM((COALESCE(vd.precio_unitario, 0) - COALESCE(p.precio_costo, 0)) * COALESCE(vd.cantidad, 0)), 0) AS ganancia_total
             FROM ventas_detalle vd
             JOIN ventas_cabecera vc ON vc.id = vd.id_venta
             JOIN productos p ON p.id = vd.id_producto
             WHERE vc.fecha >= date_trunc('month', CURRENT_DATE)
               AND ($1::int IS NULL OR vc.id_sucursal = $1)
             GROUP BY p.nombre
             ORDER BY ganancia_total DESC
             LIMIT 8`,
            params
        );

        res.json({
            success: true,
            data: {
                resumen: resumenResult.rows[0],
                semana: semanalResult.rows,
                meses: mensualResult.rows,
                metodos_pago: pagosResult.rows,
                productos_top: productosResult.rows
            }
        });
    } catch (error) {
        console.error('Error metricas financieras:', error);
        res.status(500).json({ success: false, error: 'Error al obtener metricas financieras.' });
    }
};

module.exports = {
    reporteCigarrosHoy,
    getDashboard,
    getRankingProductos,
    getReporteUtilidadMensual,
    getKpisDiarios,
    getVentasPorSucursal,
    getHistoricoVentas,
    getVentasPorTurno,
    getMetricasFinancieras
};
