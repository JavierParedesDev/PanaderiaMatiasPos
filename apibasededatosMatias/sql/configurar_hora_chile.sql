-- Ejecutar conectado a la base panaderia_matias_db.
-- Deja la base y los defaults principales usando hora chilena.

ALTER DATABASE panaderia_matias_db SET timezone TO 'America/Santiago';
SET TIME ZONE 'America/Santiago';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'turnos_caja' AND column_name = 'fecha_apertura'
    ) THEN
        ALTER TABLE public.turnos_caja
        ALTER COLUMN fecha_apertura SET DEFAULT timezone('America/Santiago', now());
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ventas_cabecera' AND column_name = 'fecha'
    ) THEN
        ALTER TABLE public.ventas_cabecera
        ALTER COLUMN fecha SET DEFAULT timezone('America/Santiago', now());
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'kardex' AND column_name = 'fecha'
    ) THEN
        ALTER TABLE public.kardex
        ALTER COLUMN fecha SET DEFAULT timezone('America/Santiago', now());
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'retiros' AND column_name = 'fecha'
    ) THEN
        ALTER TABLE public.retiros
        ALTER COLUMN fecha SET DEFAULT timezone('America/Santiago', now());
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'mermas' AND column_name = 'fecha'
    ) THEN
        ALTER TABLE public.mermas
        ALTER COLUMN fecha SET DEFAULT timezone('America/Santiago', now());
    END IF;
END $$;

-- Comprobacion:
SELECT
    now() AS hora_sesion,
    timezone('America/Santiago', now()) AS hora_chile;

-- Si ya tienes registros antiguos guardados con 4 horas de adelanto, corrige
-- solamente los IDs revisados. Ejemplo:
--
-- UPDATE turnos_caja
-- SET fecha_apertura = fecha_apertura - INTERVAL '4 hours',
--     fecha_cierre = CASE
--         WHEN fecha_cierre IS NULL THEN NULL
--         ELSE fecha_cierre - INTERVAL '4 hours'
--     END
-- WHERE id IN (15);
