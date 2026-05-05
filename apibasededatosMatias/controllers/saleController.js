const pool = require('../config/db');

const resolveSucursalId = (req) => {
    const requested = Number(req.query.id_sucursal ?? req.body?.id_sucursal);
    if (req.usuario?.rol === 'Admin' && Number.isInteger(requested) && requested > 0) {
        return requested;
    }

    if (req.usuario?.rol === 'Admin') {
        return null;
    }

    return req.usuario.id_sucursal;
};

const toNumber = (value, fallback = 0) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeSaleItems = (body = {}) => {
    const source = Array.isArray(body.detalle_productos)
        ? body.detalle_productos
        : Array.isArray(body.carrito)
            ? body.carrito
            : [];

    return source.map((item) => {
        const cantidad = toNumber(item.cantidad);
        const precioUnitario = toNumber(item.precio_unitario ?? item.precioVenta);
        const subtotal = toNumber(item.subtotal ?? item.subtotalLinea, precioUnitario * cantidad);

        return {
            id_producto: Number(item.id_producto),
            cantidad,
            precio_unitario: precioUnitario,
            subtotal
        };
    });
};

const getPaymentMethodId = async (client, candidates = []) => {
    const names = candidates.map((name) => String(name || '').toLowerCase());
    const result = await client.query('SELECT id, nombre FROM metodos_pago ORDER BY id ASC');
    const found = result.rows.find((row) => {
        const methodName = String(row.nombre || '').toLowerCase();
        return names.some((candidate) => candidate && methodName.includes(candidate));
    });

    return found?.id || result.rows[0]?.id || 1;
};

const normalizeSalePayments = async (client, body = {}, totalVenta = 0) => {
    if (Array.isArray(body.pagos_mixtos) && body.pagos_mixtos.length > 0) {
        return body.pagos_mixtos
            .map((pago) => ({
                id_metodo_pago: Number(pago.id_metodo_pago),
                monto_pagado: toNumber(pago.monto_pagado)
            }))
            .filter((pago) => Number.isInteger(pago.id_metodo_pago) && pago.id_metodo_pago > 0 && pago.monto_pagado > 0);
    }

    const efectivo = toNumber(body.pago_efectivo);
    const tarjeta = toNumber(body.pago_tarjeta);
    const transferencia = toNumber(body.pago_transferencia);
    const mixedTotal = efectivo + tarjeta + transferencia;

    if (mixedTotal > 0) {
        const payments = [];
        if (efectivo > 0) payments.push({ id_metodo_pago: await getPaymentMethodId(client, ['efectivo']), monto_pagado: efectivo });
        if (tarjeta > 0) payments.push({ id_metodo_pago: await getPaymentMethodId(client, ['tarjeta', 'debito', 'credito', 'crÃ©dito']), monto_pagado: tarjeta });
        if (transferencia > 0) payments.push({ id_metodo_pago: await getPaymentMethodId(client, ['transfe']), monto_pagado: transferencia });
        return payments;
    }

    const metodoPago = String(body.metodoPago || body.metodo_pago || 'EFECTIVO').toLowerCase();
    const idMetodoPago = metodoPago.includes('transfe')
        ? await getPaymentMethodId(client, ['transfe'])
        : metodoPago.includes('tarjeta') || metodoPago.includes('debito') || metodoPago.includes('credito') || metodoPago.includes('crÃ©dito')
            ? await getPaymentMethodId(client, ['tarjeta', 'debito', 'credito', 'crÃ©dito'])
            : await getPaymentMethodId(client, ['efectivo']);

    return [{ id_metodo_pago: idMetodoPago, monto_pagado: toNumber(body.montoPago ?? body.monto_pago, totalVenta) }];
};

const hasColumn = async (client, tableName, columnName) => {
    const result = await client.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
    );

    return result.rowCount > 0;
};

const procesarVenta = async (req, res) => {
    const id_turno = req.body.id_turno ? Number(req.body.id_turno) : null;
    const total_venta = toNumber(req.body.total_venta ?? req.body.total);
    const detalle_productos = normalizeSaleItems(req.body);
    const id_usuario = req.usuario.id;
    const id_sucursal = resolveSucursalId(req);
    const client = await pool.connect();

    try {
        if (!id_sucursal) {
            return res.status(400).json({ success: false, error: 'Debe indicar una sucursal para registrar la venta.' });
        }

        if (!Number.isFinite(total_venta) || total_venta <= 0) {
            return res.status(400).json({ success: false, error: 'El total de la venta debe ser mayor a cero.' });
        }

        if (!Array.isArray(detalle_productos) || detalle_productos.length === 0) {
            return res.status(400).json({ success: false, error: 'La venta debe incluir productos.' });
        }

        for (const item of detalle_productos) {
            if (!Number.isInteger(item.id_producto) || item.id_producto <= 0 || item.cantidad <= 0) {
                return res.status(400).json({ success: false, error: 'La venta contiene productos invalidos.' });
            }
        }

        await client.query('BEGIN');
        const pagos_mixtos = await normalizeSalePayments(client, req.body, total_venta);

        if (pagos_mixtos.length === 0) {
            throw new Error('Debe registrar al menos un pago para la venta.');
        }

        const resVenta = await client.query(
            `INSERT INTO ventas_cabecera (folio_interno, fecha, id_usuario, id_sucursal, id_turno, total_venta)
             VALUES (COALESCE((SELECT MAX(folio_interno) + 1 FROM ventas_cabecera WHERE id_sucursal = $2), 1), timezone('America/Santiago', now()), $1, $2, $3, $4) RETURNING id, folio_interno`,
            [id_usuario, id_sucursal, id_turno, total_venta]
        );
        const id_venta = resVenta.rows[0].id;
        const folio_interno = resVenta.rows[0].folio_interno;

        for (const pago of pagos_mixtos) {
            await client.query(
                `INSERT INTO ventas_pagos (id_venta, id_metodo_pago, monto_pagado) VALUES ($1, $2, $3)`,
                [id_venta, pago.id_metodo_pago, pago.monto_pagado]
            );
        }

        for (const item of detalle_productos) {
            await client.query(
                `INSERT INTO ventas_detalle (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
                [id_venta, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal]
            );

            const resStock = await client.query(
                `UPDATE inventarios
                 SET stock_actual = stock_actual - $1
                 WHERE id_producto = $2 AND id_sucursal = $3 AND stock_actual >= $1
                 RETURNING stock_actual`,
                [item.cantidad, item.id_producto, id_sucursal]
            );
            if (resStock.rows.length === 0) throw new Error(`Stock insuficiente para producto ID ${item.id_producto}`);

            await client.query(
                `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario, referencia_id) VALUES ($1, $2, 'VENTA', $3, $4, timezone('America/Santiago', now()), $5, $6)`,
                [item.id_producto, id_sucursal, -item.cantidad, resStock.rows[0].stock_actual, id_usuario, id_venta]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({
            success: true,
            mensaje: 'Venta registrada con Ã©xito',
            id_venta,
            id: id_venta,
            folio: folio_interno,
            venta: { id: id_venta, id_venta, folio: folio_interno }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message || 'Error al procesar la venta.' });
    } finally {
        client.release();
    }
};

// Obtener historial de tickets filtrado por sucursal
const getHistorialVentas = async (req, res) => {
    const id_sucursal = resolveSucursalId(req);
    const { id_turno, id_usuario, fecha_desde, fecha_hasta, metodo_pago, tipo_turno } = req.query;
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

    try {
        let whereClauses = [];
        let params = [];

        if (id_sucursal) {
            params.push(id_sucursal);
            whereClauses.push(`vc.id_sucursal = $${params.length}::int`);
        }

        if (id_turno) {
            params.push(id_turno);
            whereClauses.push(`vc.id_turno = $${params.length}::int`);
        }

        if (id_usuario) {
            params.push(id_usuario);
            whereClauses.push(`vc.id_usuario = $${params.length}::int`);
        }

        if (fecha_desde) {
            params.push(fecha_desde);
            whereClauses.push(`vc.fecha >= $${params.length}`);
        }

        if (fecha_hasta) {
            params.push(fecha_hasta + ' 23:59:59');
            whereClauses.push(`vc.fecha <= $${params.length}`);
        }

        if (metodo_pago) {
            params.push(metodo_pago);
            whereClauses.push(`EXISTS (
                SELECT 1 FROM ventas_pagos vp 
                JOIN metodos_pago mp ON vp.id_metodo_pago = mp.id 
                WHERE vp.id_venta = vc.id 
                AND mp.nombre ILIKE '%' || $${params.length} || '%'
            )`);
        }

        if (tipo_turno) {
            params.push(tipo_turno);
            whereClauses.push(`EXISTS (
                SELECT 1 FROM turnos_caja tc 
                WHERE tc.id = vc.id_turno 
                AND (tc.tipo_turno ILIKE '%' || $${params.length} || '%' OR tc.tipo_turno ILIKE '%snico%')
            )`);
        }

        const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        const countQuery = `
            SELECT COUNT(*)::int as total
            FROM ventas_cabecera vc
            ${whereSql}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = Number(countResult.rows[0]?.total || 0);

        params.push(limit);
        const limitIndex = params.length;
        params.push(offset);
        const offsetIndex = params.length;

        const query = `
            SELECT 
                vc.id, 
                vc.folio_interno, 
                vc.fecha, 
                vc.id_usuario, 
                vc.id_sucursal, 
                vc.id_turno, 
                vc.total_venta,
                u.username as vendedor, 
                s.nombre as sucursal,
                COALESCE(p.metodos_pago, 'Efectivo') AS medio_pago
            FROM ventas_cabecera vc
            JOIN usuarios u ON vc.id_usuario = u.id
            JOIN sucursales s ON vc.id_sucursal = s.id
            LEFT JOIN (
                SELECT 
                    vp.id_venta,
                    STRING_AGG(mp.nombre, ' + ' ORDER BY mp.nombre) AS metodos_pago
                FROM ventas_pagos vp
                LEFT JOIN metodos_pago mp ON mp.id = vp.id_metodo_pago
                GROUP BY vp.id_venta
            ) p ON p.id_venta = vc.id
            ${whereSql}
            ORDER BY vc.fecha DESC
            LIMIT $${limitIndex}
            OFFSET $${offsetIndex}
        `;
        const result = await pool.query(query, params);
        res.json({ 
            success: true, 
            data: result.rows,
            total,
            limit,
            offset,
            hasMore: offset + result.rowCount < total
        });
    } catch (error) {
        console.error('Error al obtener historial de ventas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener historial de ventas.' });
    }
};

const getDetalleVenta = async (req, res) => {
    const idVenta = Number(req.params.id);
    if (!Number.isInteger(idVenta) || idVenta <= 0) {
        return res.status(400).json({ success: false, error: 'ID de venta invalido.' });
    }

    const id_sucursal = resolveSucursalId(req);

    try {
        const cabeceraResult = await pool.query(
            `SELECT
                vc.id,
                vc.id AS id_venta,
                vc.folio_interno,
                vc.fecha,
                vc.fecha AS "fechaVenta",
                vc.id_usuario,
                vc.id_sucursal,
                vc.id_turno,
                vc.total_venta,
                vc.total_venta AS total,
                u.username AS vendedor,
                s.nombre AS sucursal,
                'COMPLETADA' AS estado
             FROM ventas_cabecera vc
             LEFT JOIN usuarios u ON vc.id_usuario = u.id
             LEFT JOIN sucursales s ON vc.id_sucursal = s.id
             WHERE vc.id = $1
               AND ($2::int IS NULL OR vc.id_sucursal = $2)`,
            [idVenta, id_sucursal]
        );

        if (cabeceraResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada.' });
        }

        const productosResult = await pool.query(
            `SELECT
                vd.id_producto,
                vd.cantidad,
                vd.cantidad AS "cantidadVenta",
                vd.precio_unitario,
                vd.precio_unitario AS "precioVenta",
                vd.subtotal,
                vd.subtotal AS "subtotalLinea",
                p.nombre AS "nombreProducto",
                p.codigo_barra_externo AS "codigoBarras"
             FROM ventas_detalle vd
             LEFT JOIN productos p ON p.id = vd.id_producto
             WHERE vd.id_venta = $1
             ORDER BY p.nombre ASC, vd.id_producto ASC`,
            [idVenta]
        );

        const pagosResult = await pool.query(
            `SELECT
                vp.id_metodo_pago,
                COALESCE(mp.nombre, 'Efectivo') AS "metodoPago",
                vp.monto_pagado,
                vp.monto_pagado AS "montoPago"
             FROM ventas_pagos vp
             LEFT JOIN metodos_pago mp ON mp.id = vp.id_metodo_pago
             WHERE vp.id_venta = $1
             ORDER BY mp.nombre ASC, vp.id_metodo_pago ASC`,
            [idVenta]
        );

        res.json({
            success: true,
            data: {
                cabecera: cabeceraResult.rows[0],
                productos: productosResult.rows,
                pagos: pagosResult.rows
            }
        });
    } catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).json({ success: false, error: 'Error al obtener detalle de venta.' });
    }
};

const anularVenta = async (req, res) => {
    const idVenta = Number(req.params.id);
    if (!Number.isInteger(idVenta) || idVenta <= 0) {
        return res.status(400).json({ success: false, error: 'ID de venta invalido.' });
    }

    const id_sucursal = resolveSucursalId(req);
    const id_usuario = req.usuario.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const ventaResult = await client.query(
            `SELECT id, id_sucursal
             FROM ventas_cabecera
             WHERE id = $1
               AND ($2::int IS NULL OR id_sucursal = $2)
             FOR UPDATE`,
            [idVenta, id_sucursal]
        );

        if (ventaResult.rowCount === 0) {
            throw new Error('Venta no encontrada.');
        }

        const saleBranchId = ventaResult.rows[0].id_sucursal;
        const alreadyCancelled = await client.query(
            `SELECT 1
             FROM kardex
             WHERE referencia_id = $1
               AND tipo_movimiento = 'ANULACION_VENTA'
             LIMIT 1`,
            [idVenta]
        );

        if (alreadyCancelled.rowCount > 0) {
            throw new Error('La venta ya fue anulada.');
        }

        const detalles = await client.query(
            `SELECT id_producto, cantidad
             FROM ventas_detalle
             WHERE id_venta = $1`,
            [idVenta]
        );

        for (const item of detalles.rows) {
            const stockResult = await client.query(
                `INSERT INTO inventarios (id_producto, id_sucursal, stock_actual)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id_producto, id_sucursal)
                 DO UPDATE SET stock_actual = inventarios.stock_actual + EXCLUDED.stock_actual
                 RETURNING stock_actual`,
                [item.id_producto, saleBranchId, item.cantidad]
            );

            await client.query(
                `INSERT INTO kardex (id_producto, id_sucursal, tipo_movimiento, cantidad, stock_posterior, fecha, id_usuario, referencia_id)
                 VALUES ($1, $2, 'ANULACION_VENTA', $3, $4, timezone('America/Santiago', now()), $5, $6)`,
                [item.id_producto, saleBranchId, item.cantidad, stockResult.rows[0].stock_actual, id_usuario, idVenta]
            );
        }

        if (await hasColumn(client, 'ventas_cabecera', 'estado')) {
            await client.query(`UPDATE ventas_cabecera SET estado = 'ANULADA' WHERE id = $1`, [idVenta]);
        }

        await client.query('COMMIT');
        res.json({ success: true, mensaje: 'Venta anulada correctamente. Stock devuelto a inventario.' });
    } catch (error) {
        await client.query('ROLLBACK');
        const status = error.message === 'Venta no encontrada.' ? 404 : 400;
        res.status(status).json({ success: false, error: error.message || 'Error al anular la venta.' });
    } finally {
        client.release();
    }
};

module.exports = { procesarVenta, getHistorialVentas, getDetalleVenta, anularVenta };



