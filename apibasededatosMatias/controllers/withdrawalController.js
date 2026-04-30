const pool = require('../config/db');

const registrarRetiro = async (req, res) => {
    const { id_turno, monto, motivo, descripcion } = req.body;
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    const montoRetiro = Number(monto);
    const motivoLimpio = String(motivo || '').trim();
    const descripcionLimpia = String(descripcion || '').trim();

    if (!id_turno || !Number.isFinite(montoRetiro) || montoRetiro <= 0 || !motivoLimpio) {
        return res.status(400).json({
            success: false,
            error: 'Debe indicar turno, monto mayor a 0 y motivo del retiro.'
        });
    }

    try {
        const turnoResult = await pool.query(
            `SELECT id, id_usuario, id_sucursal, estado
             FROM turnos_caja
             WHERE id = $1`,
            [id_turno]
        );

        if (turnoResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Turno no encontrado.' });
        }

        const turno = turnoResult.rows[0];
        if (turno.estado !== 'Abierto') {
            return res.status(400).json({ success: false, error: 'Solo se pueden registrar retiros en turnos abiertos.' });
        }

        if (req.usuario?.rol !== 'Admin' && Number(turno.id_usuario) !== Number(id_usuario)) {
            return res.status(403).json({ success: false, error: 'No puedes registrar retiros en un turno de otro usuario.' });
        }

        const result = await pool.query(
            `INSERT INTO retiros (id_turno, id_usuario, id_sucursal, monto, motivo, descripcion, fecha)
             VALUES ($1, $2, $3, $4, $5, $6, timezone('America/Santiago', now()))
             RETURNING *`,
            [id_turno, id_usuario, id_sucursal || turno.id_sucursal, montoRetiro, motivoLimpio, descripcionLimpia || null]
        );

        res.status(201).json({ success: true, mensaje: 'Retiro registrado correctamente.', data: result.rows[0] });
    } catch (error) {
        console.error('Error al registrar retiro:', error);
        res.status(500).json({ success: false, error: 'Error al registrar el retiro.' });
    }
};

const getRetiros = async (req, res) => {
    const { id_turno } = req.query;

    try {
        const params = [];
        let query = `
            SELECT r.*, u.username as nombre_usuario
            FROM retiros r
            LEFT JOIN usuarios u ON u.id = r.id_usuario
            WHERE 1=1
        `;

        if (id_turno) {
            params.push(id_turno);
            query += ` AND r.id_turno = $${params.length}`;
        }

        if (req.usuario?.rol !== 'Admin') {
            params.push(req.usuario.id_sucursal);
            query += ` AND r.id_sucursal = $${params.length}`;
        }

        query += ' ORDER BY r.fecha DESC LIMIT 100';

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error al obtener retiros:', error);
        res.status(500).json({ success: false, error: 'Error al obtener los retiros.' });
    }
};

module.exports = { registrarRetiro, getRetiros };
