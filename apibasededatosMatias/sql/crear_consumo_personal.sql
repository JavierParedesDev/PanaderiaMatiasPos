CREATE TABLE IF NOT EXISTS trabajadores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT timezone('America/Santiago', now()),
    CONSTRAINT uq_trabajadores_nombre_apellido UNIQUE (nombre, apellido)
);

CREATE TABLE IF NOT EXISTS consumo_personal (
    id SERIAL PRIMARY KEY,
    id_trabajador INTEGER NOT NULL REFERENCES trabajadores(id),
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id),
    id_sucursal INTEGER NOT NULL REFERENCES sucursales(id),
    id_turno INTEGER REFERENCES turnos_caja(id),
    total NUMERIC(12, 0) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    fecha TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT timezone('America/Santiago', now())
);

CREATE TABLE IF NOT EXISTS consumo_personal_detalle (
    id SERIAL PRIMARY KEY,
    id_consumo INTEGER NOT NULL REFERENCES consumo_personal(id) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES productos(id),
    cantidad NUMERIC(12, 3) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 0) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 0) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_consumo_personal_trabajador ON consumo_personal(id_trabajador);
CREATE INDEX IF NOT EXISTS idx_consumo_personal_fecha ON consumo_personal(fecha);
CREATE INDEX IF NOT EXISTS idx_consumo_personal_estado ON consumo_personal(estado);

CREATE TABLE IF NOT EXISTS consumo_personal_pagos (
    id SERIAL PRIMARY KEY,
    id_trabajador INTEGER NOT NULL REFERENCES trabajadores(id),
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id),
    monto NUMERIC(12, 0) NOT NULL CHECK (monto > 0),
    observacion TEXT,
    fecha TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT timezone('America/Santiago', now())
);

CREATE INDEX IF NOT EXISTS idx_consumo_personal_pagos_trabajador ON consumo_personal_pagos(id_trabajador);
CREATE INDEX IF NOT EXISTS idx_consumo_personal_pagos_fecha ON consumo_personal_pagos(fecha);
