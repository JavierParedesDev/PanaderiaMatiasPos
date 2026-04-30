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
