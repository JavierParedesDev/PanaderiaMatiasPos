const pool = require('../config/db');

/**
 * Obtener todos los turnos con filtros para administración
 */
const getTurnos = async (req, res) => {
    const { estado, sucursal } = req.query;
    try {
        let query = `
            SELECT 
                t.*, 
                u.nombre_completo as nombre_usuario, 
                u.username,
                s.nombre as nombre_sucursal
            FROM turnos_caja t
            JOIN usuarios u ON t.id_usuario = u.id
            JOIN sucursales s ON t.id_sucursal = s.id
            WHERE 1=1
        `;
        const params = [];

        if (estado) {
            params.push(estado);
            query += ` AND t.estado = $${params.length}`;
        }

        if (sucursal) {
            params.push(sucursal);
            query += ` AND s.nombre = $${params.length}`;
        }

        query += ` ORDER BY t.fecha_apertura DESC LIMIT 50`;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error al obtener turnos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener la lista de turnos.' });
    }
};

const abrirTurno = async (req, res) => {
    const { tipo_turno, monto_apertura } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    try {
        const checkTurno = await pool.query('SELECT id FROM turnos_caja WHERE id_usuario = $1 AND estado = $2', [id_usuario, 'Abierto']);
        if (checkTurno.rows.length > 0) return res.status(400).json({ error: 'Ya tienes un turno abierto.' });

        const result = await pool.query(
            `INSERT INTO turnos_caja (id_usuario, id_sucursal, tipo_turno, monto_apertura, estado) 
             VALUES ($1, $2, $3, $4, 'Abierto') RETURNING id, fecha_apertura`,
            [id_usuario, id_sucursal, tipo_turno, monto_apertura]
        );
        res.json({ success: true, mensaje: 'Turno abierto', turno: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al abrir el turno.' });
    }
};

const cerrarTurno = async (req, res) => {
    const { id_turno, monto_cierre_efectivo_declarado } = req.body;
    try {
        const ventasEfectivo = await pool.query(
            `SELECT COALESCE(SUM(vp.monto_pagado), 0) as total_efectivo
             FROM ventas_pagos vp JOIN ventas_cabecera vc ON vp.id_venta = vc.id JOIN metodos_pago mp ON vp.id_metodo_pago = mp.id
             WHERE vc.id_turno = $1 AND mp.nombre = 'Efectivo'`, [id_turno]
        );
        const totalEfectivoSistema = parseFloat(ventasEfectivo.rows[0].total_efectivo);

        const turnoInfo = await pool.query('SELECT monto_apertura FROM turnos_caja WHERE id = $1', [id_turno]);
        const montoApertura = parseFloat(turnoInfo.rows[0].monto_apertura);

        const efectivoEsperado = montoApertura + totalEfectivoSistema;
        const diferencia = parseFloat(monto_cierre_efectivo_declarado) - efectivoEsperado;

        await pool.query(
            `UPDATE turnos_caja SET fecha_cierre = NOW(), ventas_efectivo_sistema = $1, monto_cierre_efectivo_declarado = $2, diferencia_efectivo = $3, estado = 'Cerrado' WHERE id = $4`,
            [totalEfectivoSistema, monto_cierre_efectivo_declarado, diferencia, id_turno]
        );
        res.json({ success: true, mensaje: 'Turno cerrado', resumen: { esperado: efectivoEsperado, declarado: monto_cierre_efectivo_declarado, diferencia } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cerrar el turno.' });
    }
};

module.exports = { getTurnos, abrirTurno, cerrarTurno };
