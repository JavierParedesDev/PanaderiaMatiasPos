CREATE TABLE IF NOT EXISTS retiros (
    id SERIAL PRIMARY KEY,
    id_turno INTEGER NOT NULL REFERENCES turnos_caja(id) ON DELETE CASCADE,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id),
    id_sucursal INTEGER NOT NULL REFERENCES sucursales(id),
    monto NUMERIC(12, 0) NOT NULL CHECK (monto > 0),
    motivo VARCHAR(120) NOT NULL,
    descripcion TEXT,
    fecha TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retiros_id_turno ON retiros(id_turno);
CREATE INDEX IF NOT EXISTS idx_retiros_fecha ON retiros(fecha);
