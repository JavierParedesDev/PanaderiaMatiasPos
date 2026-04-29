const pool = require('../config/db');

/**
 * Obtener todos los turnos con filtros para administración
 */
const getTurnos = async (req, res) => {
    const { estado } = req.query;
    try {
        let query = `
            SELECT 
                t.*
            FROM turnos_caja t
            WHERE 1=1
        `;
        const params = [];

        if (estado) {
            params.push(estado);
            query += ` AND t.estado = $${params.length}`;
        }

        query += ` ORDER BY t.fecha_apertura DESC LIMIT 50`;

        const result = await pool.query(query, params);
        const turnos = result.rows;

        const usuariosIds = [...new Set(turnos.map((turno) => turno.id_usuario).filter(Boolean))];
        const sucursalesIds = [...new Set(turnos.map((turno) => turno.id_sucursal).filter(Boolean))];
        const usuarios = new Map();
        const sucursales = new Map();

        if (usuariosIds.length) {
            try {
                const usuariosResult = await pool.query(
                    `SELECT id, nombre_completo, username
                     FROM usuarios
                     WHERE id = ANY($1)`,
                    [usuariosIds]
                );

                usuariosResult.rows.forEach((usuario) => {
                    usuarios.set(Number(usuario.id), usuario);
                });
            } catch (userError) {
                console.error('Error al cargar usuarios para turnos:', userError);
            }
        }

        if (sucursalesIds.length) {
            try {
                const sucursalesResult = await pool.query(
                    `SELECT id, nombre
                     FROM sucursales
                     WHERE id = ANY($1)`,
                    [sucursalesIds]
                );

                sucursalesResult.rows.forEach((sucursalItem) => {
                    sucursales.set(Number(sucursalItem.id), sucursalItem);
                });
            } catch (branchError) {
                console.error('Error al cargar sucursales para turnos:', branchError);
            }
        }

        const data = turnos.map((turno) => {
            const usuario = usuarios.get(Number(turno.id_usuario));
            const sucursalItem = sucursales.get(Number(turno.id_sucursal));

            return {
                ...turno,
                nombre_usuario: usuario?.nombre_completo || usuario?.username || `Usuario ${turno.id_usuario || ''}`.trim(),
                username: usuario?.username || `usuario_${turno.id_usuario || ''}`.trim(),
                nombre_sucursal: sucursalItem?.nombre || `Sucursal ${turno.id_sucursal || ''}`.trim()
            };
        });

        res.json({ success: true, data });
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

const getResumenTurno = async (req, res) => {
    const { id } = req.params;
    try {
        const turnoInfo = await pool.query('SELECT id, monto_apertura, estado FROM turnos_caja WHERE id = $1', [id]);
        if (turnoInfo.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Turno no encontrado' });
        }
        
        const montoApertura = parseFloat(turnoInfo.rows[0].monto_apertura);

        const ventasMetodos = await pool.query(
            `SELECT mp.nombre as metodo, COALESCE(SUM(vp.monto_pagado), 0) as total
             FROM ventas_pagos vp 
             JOIN ventas_cabecera vc ON vp.id_venta = vc.id 
             JOIN metodos_pago mp ON vp.id_metodo_pago = mp.id
             WHERE vc.id_turno = $1
             GROUP BY mp.nombre`, [id]
        );

        let totalEfectivo = 0;
        let totalTarjeta = 0;

        ventasMetodos.rows.forEach(row => {
            const metodo = (row.metodo || '').toLowerCase();
            const total = parseFloat(row.total);
            if (metodo.includes('tarjeta') || metodo.includes('debito') || metodo.includes('credito') || metodo.includes('transfe')) {
                totalTarjeta += total;
            } else {
                totalEfectivo += total;
            }
        });

        const efectivoEsperado = montoApertura + totalEfectivo;

        res.json({ 
            success: true, 
            data: {
                id_turno: id,
                monto_apertura: montoApertura,
                total_efectivo: totalEfectivo,
                total_tarjeta: totalTarjeta,
                total_esperado_efectivo: efectivoEsperado
            } 
        });
    } catch (error) {
        console.error('Error al obtener resumen del turno:', error);
        res.status(500).json({ success: false, error: 'Error al obtener resumen del turno.' });
    }
};

module.exports = { getTurnos, abrirTurno, cerrarTurno, getResumenTurno };
