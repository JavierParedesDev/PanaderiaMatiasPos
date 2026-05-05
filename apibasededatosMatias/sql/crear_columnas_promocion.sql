-- Añade las columnas para promociones a la tabla de productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS cantidad_promo INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio_promo NUMERIC(12,2) DEFAULT 0;
