const pool = require('../config/db');

const toNumber = (value, fallback = null) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeTurnoValue = (value = '') => String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const extractAllowedTurnos = (definition = '') => {
    const matches = [...String(definition).matchAll(/'([^']+)'/g)];
    return matches.map((match) => match[1]).filter(Boolean);
};

const getAllowedTurnosFromDb = async (client) => {
    const result = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
         WHERE conrelid = 'turnos_caja'::regclass
           AND contype = 'c'`
    );

    const constraint = result.rows.find((row) => String(row.def || '').includes('tipo_turno'));
    if (!constraint) return [];
    return extractAllowedTurnos(constraint.def);
};

/**
 * Obtener todos los turnos con filtros para administracion
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
                    `SELECT id, username
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
                nombre_usuario: usuario?.username || `Usuario ${turno.id_usuario || ''}`.trim(),
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
    const montoApertura = toNumber(monto_apertura, null);

    const normalizedTurno = String(tipo_turno || 'Único').trim();
    const normalizedLower = normalizeTurnoValue(normalizedTurno);
    const turnoKey = normalizedLower === 'manana'
        ? 'manana'
        : normalizedLower === 'tarde'
            ? 'tarde'
            : 'unico';
    const turnoCandidates = {
        unico: ['Único', 'Unico', 'UNICO'],
        manana: ['Mañana', 'Manana', 'MANANA'],
        tarde: ['Tarde', 'TARDE']
    };

    try {
        if (montoApertura === null || montoApertura < 0) {
            return res.status(400).json({ error: 'Monto de apertura inválido.' });
        }

        let id_sucursal = req.usuario.id_sucursal || null;
        if (!id_sucursal) {
            const sucursalRes = await pool.query('SELECT id FROM sucursales ORDER BY id ASC LIMIT 1');
            id_sucursal = sucursalRes.rows[0]?.id || null;
        }

        if (!id_sucursal) {
            return res.status(400).json({ error: 'No se encontró sucursal para abrir turno.' });
        }

        const checkTurno = await pool.query('SELECT id FROM turnos_caja WHERE id_usuario = $1 AND estado = $2', [id_usuario, 'Abierto']);
        if (checkTurno.rows.length > 0) return res.status(400).json({ error: 'Ya tienes un turno abierto.' });

        let result = null;
        const tried = new Set();
        let candidates = turnoCandidates[turnoKey] || turnoCandidates.unico;
        if (turnoKey === 'unico') {
            candidates = candidates.filter((candidate) => normalizeTurnoValue(candidate) === 'unico');
        }
        for (const candidate of candidates) {
            try {
                tried.add(candidate);
                result = await pool.query(
                    `INSERT INTO turnos_caja (id_usuario, id_sucursal, tipo_turno, monto_apertura, estado, fecha_apertura) 
                     VALUES ($1, $2, $3, $4, 'Abierto', timezone('America/Santiago', now())) RETURNING id, fecha_apertura`,
                    [id_usuario, id_sucursal, candidate, montoApertura]
                );
                break;
            } catch (insertError) {
                if (insertError?.code !== '23514') {
                    throw insertError;
                }
            }
        }

        if (!result) {
            const allowedTurnos = await getAllowedTurnosFromDb(pool);
            const extraCandidates = allowedTurnos.filter((value) => {
                if (turnoKey === 'unico') {
                    return normalizeTurnoValue(value) === 'unico' && !tried.has(value);
                }
                return !tried.has(value);
            });
            for (const candidate of extraCandidates) {
                try {
                    tried.add(candidate);
                    result = await pool.query(
                        `INSERT INTO turnos_caja (id_usuario, id_sucursal, tipo_turno, monto_apertura, estado, fecha_apertura) 
                         VALUES ($1, $2, $3, $4, 'Abierto', timezone('America/Santiago', now())) RETURNING id, fecha_apertura`,
                        [id_usuario, id_sucursal, candidate, montoApertura]
                    );
                    break;
                } catch (insertError) {
                    if (insertError?.code !== '23514') {
                        throw insertError;
                    }
                }
            }

            if (!result && allowedTurnos.length) {
                return res.status(400).json({
                    error: `Tipo de turno inválido para la base de datos. Permitidos: ${allowedTurnos.join(', ')}`
                });
            }
        }

        if (!result) {
            return res.status(400).json({ error: 'Tipo de turno inválido para la base de datos.' });
        }
        res.json({ success: true, mensaje: 'Turno abierto', turno: result.rows[0] });
    } catch (error) {
        console.error('Error al abrir el turno:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al abrir el turno.' });
    }
};

const cerrarTurno = async (req, res) => {
    const { id_turno, monto_cierre_efectivo_declarado } = req.body;
    try {
        const ventasMetodos = await pool.query(
            `SELECT mp.nombre as metodo, COALESCE(SUM(vp.monto_pagado), 0) as total
             FROM ventas_pagos vp 
             JOIN ventas_cabecera vc ON vp.id_venta = vc.id 
             JOIN metodos_pago mp ON vp.id_metodo_pago = mp.id
             WHERE vc.id_turno = $1
             GROUP BY mp.nombre`,
            [id_turno]
        );

        let totalEfectivoSistema = 0;
        let totalTarjeta = 0;
        let totalTransferencia = 0;

        ventasMetodos.rows.forEach(row => {
            const metodo = (row.metodo || '').toLowerCase();
            const total = parseFloat(row.total);

            if (metodo.includes('transfe')) {
                totalTransferencia += total;
            } else if (metodo.includes('tarjeta') || metodo.includes('debito') || metodo.includes('credito')) {
                totalTarjeta += total;
            } else {
                totalEfectivoSistema += total;
            }
        });

        const montoTotal = totalEfectivoSistema + totalTarjeta + totalTransferencia;

        const retirosResult = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total_retiros
             FROM retiros
             WHERE id_turno = $1`,
            [id_turno]
        );
        const totalRetiros = parseFloat(retirosResult.rows[0].total_retiros);

        const retirosDetalle = await pool.query(
            `SELECT monto, motivo, descripcion, fecha
             FROM retiros
             WHERE id_turno = $1
             ORDER BY fecha ASC`,
            [id_turno]
        );

        const turnoInfo = await pool.query(
            `SELECT t.monto_apertura, t.fecha_apertura, t.tipo_turno, u.username as nombre_usuario
             FROM turnos_caja t
             LEFT JOIN usuarios u ON u.id = t.id_usuario
             WHERE t.id = $1`,
            [id_turno]
        );
        const montoApertura = parseFloat(turnoInfo.rows[0].monto_apertura);

        const cigarrosResult = await pool.query(
            `SELECT p.nombre AS producto,
                    SUM(vd.cantidad) AS unidades_vendidas,
                    SUM(vd.subtotal) AS total_recaudado
             FROM ventas_detalle vd
             JOIN ventas_cabecera vc ON vd.id_venta = vc.id
             JOIN productos p ON vd.id_producto = p.id
             JOIN categorias c ON p.id_categoria = c.id
             WHERE vc.id_turno = $1
               AND c.nombre = 'Cigarros'
             GROUP BY p.nombre
             ORDER BY p.nombre ASC`,
            [id_turno]
        );

        const cigarros = cigarrosResult.rows || [];
        const cigarrosTotal = cigarros.reduce((acc, item) => acc + Number(item.total_recaudado || 0), 0);

        const efectivoEsperado = montoApertura + totalEfectivoSistema - totalRetiros;
        const diferencia = parseFloat(monto_cierre_efectivo_declarado) - efectivoEsperado;

        const cierreResult = await pool.query(
            `UPDATE turnos_caja
             SET fecha_cierre = timezone('America/Santiago', now()), ventas_efectivo_sistema = $1, monto_cierre_efectivo_declarado = $2, diferencia_efectivo = $3, estado = 'Cerrado'
             WHERE id = $4
             RETURNING fecha_cierre`,
            [totalEfectivoSistema, monto_cierre_efectivo_declarado, diferencia, id_turno]
        );

        res.json({
            success: true,
            mensaje: 'Turno cerrado',
            resumen: {
                ventas_efectivo: totalEfectivoSistema,
                ventas_tarjeta: totalTarjeta,
                ventas_transferencia: totalTransferencia,
                monto_total: montoTotal,
                monto_apertura: montoApertura,
                esperado: efectivoEsperado,
                declarado: Number(monto_cierre_efectivo_declarado),
                diferencia,
                cuadrado: Math.abs(diferencia) < 1,
                total_retiros: totalRetiros,
                retiros: retirosDetalle.rows,
                cajero: turnoInfo.rows[0].nombre_usuario || `Usuario ${req.usuario.id}`,
                tipo_turno: turnoInfo.rows[0].tipo_turno || 'Único',
                fecha_inicio: turnoInfo.rows[0].fecha_apertura,
                fecha_termino: cierreResult.rows[0].fecha_cierre,
                cigarros_total: cigarrosTotal,
                cigarros
            }
        });
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
        let totalTransferencia = 0;

        ventasMetodos.rows.forEach(row => {
            const metodo = (row.metodo || '').toLowerCase();
            const total = parseFloat(row.total);
            if (metodo.includes('transfe')) {
                totalTransferencia += total;
            } else if (metodo.includes('tarjeta') || metodo.includes('debito') || metodo.includes('credito')) {
                totalTarjeta += total;
            } else {
                totalEfectivo += total;
            }
        });

        const retirosResult = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total_retiros
             FROM retiros
             WHERE id_turno = $1`,
            [id]
        );
        const totalRetiros = parseFloat(retirosResult.rows[0].total_retiros);

        const efectivoEsperado = montoApertura + totalEfectivo - totalRetiros;

        res.json({ 
            success: true, 
            data: {
                id_turno: id,
                monto_apertura: montoApertura,
                total_efectivo: totalEfectivo,
                total_tarjeta: totalTarjeta,
                total_transferencia: totalTransferencia,
                total_retiros: totalRetiros,
                total_esperado_efectivo: efectivoEsperado
            } 
        });
    } catch (error) {
        console.error('Error al obtener resumen del turno:', error);
        res.status(500).json({ success: false, error: 'Error al obtener resumen del turno.' });
    }
};

module.exports = { getTurnos, abrirTurno, cerrarTurno, getResumenTurno };
