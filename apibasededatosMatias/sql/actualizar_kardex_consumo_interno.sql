-- Permite registrar movimientos de consumo interno en kardex.
-- Ejecutar una sola vez en la base panaderia_matias_db.

ALTER TABLE public.kardex
DROP CONSTRAINT IF EXISTS kardex_tipo_movimiento_check;

ALTER TABLE public.kardex
ADD CONSTRAINT kardex_tipo_movimiento_check
CHECK (tipo_movimiento IN (
    'VENTA',
    'COMPRA',
    'AJUSTE',
    'MERMA',
    'CONSUMO_INTERNO'
));
