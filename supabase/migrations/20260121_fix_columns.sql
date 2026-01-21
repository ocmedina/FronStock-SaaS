-- =============================================================================
-- MIGRACIÓN IMPORTANTE: Precios Mayoristas y Tipo de Cliente
-- =============================================================================
-- INSTRUCCIONES: Ejecuta este script COMPLETO en Supabase SQL Editor
-- =============================================================================

-- 1. Agregar tipo de cliente (si no existe)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale'));

-- 2. Agregar precio mayorista a productos (ESTO FALTABA)
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price numeric DEFAULT NULL;

-- 3. Asegurar que balance existe
ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;

-- 4. Recrear índices por si acaso
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);

-- NOTA: Si ya tenías la función process_sale anterior, este script NO la toca para evitar conflictos.
-- Si necesitas actualizarla, usa el script anterior.
