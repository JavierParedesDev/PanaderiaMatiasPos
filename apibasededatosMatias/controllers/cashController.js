const pool = require('../config/db');

const toNumber = (value, fallback = 0) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeTurn = (turno) => ({
    id_cajaTurno: turno.id,
    id_turno: turno.id,
    montoInicial: toNumber(turno.monto_apertura),
    montoApertura: toNumber(turno.monto_apertura),
    horaApertura: turno.fecha_apertura,
    fechaApertura: turno.fecha_apertura,
    estado: turno.estado
});

async function getOpenTurn(req) {
    const result = await pool.query(
        `SELECT *
         FROM turnos_caja
         WHERE id_usuario = $1
           AND estado = 'Abierto'
         ORDER BY fecha_apertura DESC
         LIMIT 1`,
        [req.usuario.id]
    );

    return result.rows[0] || null;
}

const getCashStatus = async (req, res) => {
    try {
        const turno = await getOpenTurn(req);
        if (!turno) {
            return res.json({ success: true, abierta: false, caja: null });
        }

        res.json({ success: true, abierta: true, caja: normalizeTurn(turno), id_cajaTurno: turno.id });
    } catch (error) {
        console.error('Error al obtener estado de caja:', error);
        res.status(500).json({ success: false, error: 'Error al obtener estado de caja.' });
    }
};

const openCash = async (req, res) => {
    const montoInicial = toNumber(req.body.montoInicial ?? req.body.monto_apertura);
    const tipoTurno = req.body.tipo_turno || 'Caja';

    try {
        const existing = await getOpenTurn(req);
        if (existing) {
            return res.status(400).json({ success: false, error: 'Ya tienes un turno abierto.' });
        }

        const result = await pool.query(
            `INSERT INTO turnos_caja (id_usuario, id_sucursal, tipo_turno, monto_apertura, estado, fecha_apertura)
             VALUES ($1, $2, $3, $4, 'Abierto', timezone('America/Santiago', now()))
             RETURNING *`,
            [req.usuario.id, req.usuario.id_sucursal, tipoTurno, montoInicial]
        );
        const turno = result.rows[0];

        res.json({ success: true, mensaje: 'Caja abierta', caja: normalizeTurn(turno), id_cajaTurno: turno.id });
    } catch (error) {
        console.error('Error al abrir caja:', error);
        res.status(500).json({ success: false, error: 'Error al abrir la caja.' });
    }
};

const closeCash = async (req, res) => {
    try {
        const turno = await getOpenTurn(req);
        if (!turno) {
            return res.status(404).json({ success: false, error: 'No tienes una caja abierta.' });
        }

        const declarado = toNumber(req.body.monto_efectivo ?? req.body.monto_cierre_efectivo_declarado);
        const ventasEfectivo = toNumber(req.body.monto_efectivo);
        const diferencia = toNumber(req.body.diferencia_efectivo);

        const result = await pool.query(
            `UPDATE turnos_caja
             SET fecha_cierre = timezone('America/Santiago', now()),
                 ventas_efectivo_sistema = $1,
                 monto_cierre_efectivo_declarado = $2,
                 diferencia_efectivo = $3,
                 estado = 'Cerrado'
             WHERE id = $4
             RETURNING *`,
            [ventasEfectivo, declarado, diferencia, turno.id]
        );

        res.json({ success: true, mensaje: 'Caja cerrada', caja: normalizeTurn(result.rows[0]) });
    } catch (error) {
        console.error('Error al cerrar caja:', error);
        res.status(500).json({ success: false, error: 'Error al cerrar la caja.' });
    }
};

const getCashWithdrawals = async (req, res) => {
    try {
        const turno = await getOpenTurn(req);
        if (!turno) {
            return res.json({ success: true, data: [], totalRetirado: 0 });
        }

        const result = await pool.query(
            `SELECT *
             FROM retiros
             WHERE id_turno = $1
             ORDER BY fecha DESC`,
            [turno.id]
        );
        const totalRetirado = result.rows.reduce((sum, retiro) => sum + toNumber(retiro.monto), 0);

        res.json({ success: true, data: result.rows, totalRetirado });
    } catch (error) {
        console.error('Error al obtener retiros de caja:', error);
        res.status(500).json({ success: false, error: 'Error al obtener retiros de caja.' });
    }
};

const registerCashWithdrawal = async (req, res) => {
    const monto = toNumber(req.body.monto);
    const motivo = String(req.body.motivo || '').trim();

    if (!Number.isFinite(monto) || monto <= 0 || !motivo) {
        return res.status(400).json({ success: false, error: 'Debe indicar monto y motivo del retiro.' });
    }

    try {
        const turno = await getOpenTurn(req);
        if (!turno) {
            return res.status(400).json({ success: false, error: 'Debes tener una caja abierta para registrar retiro.' });
        }

        const result = await pool.query(
            `INSERT INTO retiros (id_turno, id_usuario, id_sucursal, monto, motivo, descripcion, fecha)
             VALUES ($1, $2, $3, $4, $5, $6, timezone('America/Santiago', now()))
             RETURNING *`,
            [turno.id, req.usuario.id, req.usuario.id_sucursal || turno.id_sucursal, monto, motivo, req.body.descripcion || null]
        );
        const retiro = result.rows[0];

        res.status(201).json({ success: true, mensaje: 'Retiro registrado correctamente.', ...retiro, data: retiro });
    } catch (error) {
        console.error('Error al registrar retiro de caja:', error);
        res.status(500).json({ success: false, error: 'Error al registrar retiro de caja.' });
    }
};

module.exports = {
    getCashStatus,
    openCash,
    closeCash,
    getCashWithdrawals,
    registerCashWithdrawal
};
