const pool = require('../config/db');

const parseNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const getTrabajadores = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, apellido, activo, fecha_creacion
             FROM trabajadores
             WHERE activo = true
             ORDER BY nombre ASC, apellido ASC`
        );

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error al obtener trabajadores:', error);
        res.status(500).json({ success: false, error: 'Error al obtener trabajadores.' });
    }
};

const crearTrabajador = async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const apellido = String(req.body.apellido || '').trim();

    if (!nombre || !apellido) {
        return res.status(400).json({ success: false, error: 'Debe indicar nombre y apellido.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO trabajadores (nombre, apellido, activo, fecha_creacion)
             VALUES ($1, $2, true, timezone('America/Santiago', now()))
             RETURNING id, nombre, apellido, activo, fecha_creacion`,
            [nombre, apellido]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, error: 'Ese trabajador ya existe.' });
        }

        console.error('Error al crear trabajador:', error);
        res.status(500).json({ success: false, error: 'Error al crear trabajador.' });
    }
};

const registrarConsumo = async (req, res) => {
    const id_trabajador = Number(req.body.id_trabajador);
    const id_turno = req.body.id_turno ? Number(req.body.id_turno) : null;
    const detalle_productos = Array.isArray(req.body.detalle_productos) ? req.body.detalle_productos : [];
    const id_usuario = req.usuario.id;
    const id_sucursal = req.usuario.id_sucursal;

    if (!Number.isInteger(id_trabajador) || id_trabajador <= 0) {
        return res.status(400).json({ success: false, error: 'Debe seleccionar un trabajador.' });
    }

    if (!detalle_productos.length) {
        return res.status(400).json({ success: false, error: 'Debe agregar productos al consumo interno.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const trabajadorResult = await client.query(
            'SELECT id FROM trabajadores WHERE id = $1 AND activo = true',
            [id_trabajador]
        );

        if (trabajadorResult.rows.length === 0) {
            throw new Error('Trabajador no encontrado o inactivo.');
        }

        const consumoResult = await client.query(
            `INSERT INTO consumo_personal (id_trabajador, id_usuario, id_sucursal, id_turno, total, estado, fecha)
             VALUES ($1, $2, $3, $4, 0, 'Pendiente', timezone('America/Santiago', now()))
             RETURNING id`,
            [id_trabajador, id_usuario, id_sucursal, id_turno]
        );

        const id_consumo = consumoResult.rows[0].id;
        let totalConsumo = 0;

        for (const item of detalle_productos) {
            const id_producto = Number(item.id_producto);
            const cantidad = parseNumber(item.cantidad);

            if (!Number.isInteger(id_producto) || id_producto <= 0 || cantidad === null || cantidad <= 0) {
                throw new Error('Hay productos invalidos en el consumo interno.');
            }

            const productoResult = await client.query(
                'SELECT id, precio_venta FROM productos WHERE id = $1',
                [id_producto]
            );

            if (productoResult.rows.length === 0) {
                throw new Error(`Producto ID ${id_producto} no encontrado.`);
            }

            const precioUnitario = parseNumber(item.precio_unitario) ?? Number(productoResult.rows[0].precio_venta || 0);
            const subtotal = cantidad * precioUnitario;

            const stockResult = await client.query(
                `UPDATE inventarios
                 SET stock_actual = stock_actual - $1
                 WHERE id_producto = $2 AND id_sucursal = $3 AND stock_actual >= $1
                 RETURNING stock_actual`,
                [cantidad, id_producto, id_sucursal]
            );

            if (stockResult.rows.length === 0) {
                throw new Error(`Stock insuficiente para producto ID ${id_producto}.`);
            }

            await client.query(
                `INSERT INTO consumo_personal_detalle (id_consumo, id_producto, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id_consumo, id_producto, cantidad, precioUnitario, subtotal]
            );

            await client.query(
                `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario, referencia_id)
                 VALUES ($1, $2, 'AJUSTE', $3, $4, timezone('America/Santiago', now()), $5, $6)`,
                [id_producto, id_sucursal, -cantidad, stockResult.rows[0].stock_actual, id_usuario, id_consumo]
            );

            totalConsumo += subtotal;
        }

        await client.query('UPDATE consumo_personal SET total = $1 WHERE id = $2', [totalConsumo, id_consumo]);
        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            mensaje: 'Consumo interno registrado correctamente.',
            data: { id: id_consumo, total: totalConsumo }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar consumo interno:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al registrar consumo interno.' });
    } finally {
        client.release();
    }
};

const getConsumos = async (req, res) => {
    const { id_trabajador, estado } = req.query;

    try {
        const params = [];
        let where = 'WHERE 1=1';

        if (id_trabajador) {
            params.push(id_trabajador);
            where += ` AND cp.id_trabajador = $${params.length}`;
        }

        if (estado) {
            params.push(estado);
            where += ` AND cp.estado = $${params.length}`;
        }

        const consumosResult = await pool.query(
            `SELECT
                cp.id,
                cp.fecha,
                cp.total,
                cp.estado,
                cp.id_trabajador,
                CONCAT(t.nombre, ' ', t.apellido) as trabajador,
                u.username as cajero,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'producto', p.nombre,
                            'cantidad', cpd.cantidad,
                            'precio_unitario', cpd.precio_unitario,
                            'subtotal', cpd.subtotal
                        )
                    ) FILTER (WHERE cpd.id IS NOT NULL),
                    '[]'
                ) as detalle
             FROM consumo_personal cp
             JOIN trabajadores t ON t.id = cp.id_trabajador
             LEFT JOIN usuarios u ON u.id = cp.id_usuario
             LEFT JOIN consumo_personal_detalle cpd ON cpd.id_consumo = cp.id
             LEFT JOIN productos p ON p.id = cpd.id_producto
             ${where}
             GROUP BY cp.id, t.nombre, t.apellido, u.username
             ORDER BY cp.fecha DESC
             LIMIT 300`,
            params
        );

        const resumenResult = await pool.query(
            `SELECT
                t.id,
                t.nombre,
                t.apellido,
                COALESCE(consumos.total_consumos, 0) as total_consumos,
                COALESCE(pagos.total_pagos, 0) as total_pagos,
                GREATEST(COALESCE(consumos.total_consumos, 0) - COALESCE(pagos.total_pagos, 0), 0) as saldo_pendiente,
                COALESCE(consumos.consumos_count, 0) as consumos_pendientes
             FROM trabajadores t
             LEFT JOIN (
                SELECT id_trabajador, SUM(total) as total_consumos, COUNT(*) as consumos_count, MIN(fecha) as fecha_inicio_deuda
                FROM consumo_personal
                WHERE estado = 'Pendiente'
                GROUP BY id_trabajador
             ) consumos ON consumos.id_trabajador = t.id
             LEFT JOIN LATERAL (
                SELECT SUM(cpp.monto) as total_pagos
                FROM consumo_personal_pagos cpp
                WHERE cpp.id_trabajador = t.id
                  AND consumos.fecha_inicio_deuda IS NOT NULL
                  AND cpp.fecha >= consumos.fecha_inicio_deuda
             ) pagos ON true
             WHERE t.activo = true
             GROUP BY t.id, consumos.total_consumos, consumos.consumos_count, pagos.total_pagos
             ORDER BY saldo_pendiente DESC, t.nombre ASC`
        );

        let pagosRows = [];
        if (id_trabajador) {
            const pagosResult = await pool.query(
                `SELECT cpp.*, u.username as cajero
                 FROM consumo_personal_pagos cpp
                 LEFT JOIN usuarios u ON u.id = cpp.id_usuario
                 WHERE cpp.id_trabajador = $1
                   AND cpp.fecha >= COALESCE(
                        (SELECT MIN(fecha) FROM consumo_personal WHERE id_trabajador = $1 AND estado = 'Pendiente'),
                        cpp.fecha
                   )
                 ORDER BY cpp.fecha DESC
                 LIMIT 100`,
                [id_trabajador]
            );
            pagosRows = pagosResult.rows;
        }

        res.json({ success: true, data: consumosResult.rows, resumen: resumenResult.rows, pagos: pagosRows });
    } catch (error) {
        console.error('Error al obtener consumos internos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener consumos internos.' });
    }
};

const registrarPago = async (req, res) => {
    const id_trabajador = Number(req.params.id_trabajador);
    const monto = parseNumber(req.body.monto);
    const observacion = String(req.body.observacion || '').trim();
    const id_usuario = req.usuario.id;

    if (!Number.isInteger(id_trabajador) || id_trabajador <= 0) {
        return res.status(400).json({ success: false, error: 'Trabajador invalido.' });
    }

    if (monto === null || monto <= 0) {
        return res.status(400).json({ success: false, error: 'El monto del pago debe ser mayor a cero.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const trabajadorResult = await client.query(
            'SELECT id FROM trabajadores WHERE id = $1 AND activo = true',
            [id_trabajador]
        );

        if (trabajadorResult.rows.length === 0) {
            throw new Error('Trabajador no encontrado o inactivo.');
        }

        await client.query(
            `INSERT INTO consumo_personal_pagos (id_trabajador, id_usuario, monto, observacion, fecha)
             VALUES ($1, $2, $3, $4, timezone('America/Santiago', now()))`,
            [id_trabajador, id_usuario, monto, observacion || null]
        );

        const saldoResult = await client.query(
            `SELECT
                COALESCE((SELECT SUM(total) FROM consumo_personal WHERE id_trabajador = $1 AND estado = 'Pendiente'), 0) as total_consumos,
                COALESCE((
                    SELECT SUM(monto)
                    FROM consumo_personal_pagos
                    WHERE id_trabajador = $1
                      AND fecha >= COALESCE(
                        (SELECT MIN(fecha) FROM consumo_personal WHERE id_trabajador = $1 AND estado = 'Pendiente'),
                        fecha
                      )
                ), 0) as total_pagos`,
            [id_trabajador]
        );

        const totalConsumos = Number(saldoResult.rows[0].total_consumos || 0);
        const totalPagos = Number(saldoResult.rows[0].total_pagos || 0);
        const saldo = Math.max(totalConsumos - totalPagos, 0);

        if (saldo <= 0) {
            await client.query(
                `UPDATE consumo_personal SET estado = 'Pagado' WHERE id_trabajador = $1 AND estado = 'Pendiente'`,
                [id_trabajador]
            );
            await client.query(
                `DELETE FROM consumo_personal_pagos
                 WHERE id_trabajador = $1
                   AND fecha >= COALESCE(
                        (SELECT MIN(fecha) FROM consumo_personal WHERE id_trabajador = $1 AND estado = 'Pagado'),
                        fecha
                   )`,
                [id_trabajador]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, mensaje: 'Pago registrado correctamente.', data: { saldo } });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar pago de consumo:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al registrar pago.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getTrabajadores,
    crearTrabajador,
    registrarConsumo,
    getConsumos,
    registrarPago
};
