-- =============================================================================
-- MIGRACIÓN: TIPO DE SERVICIO DE CLIENTE (2026-02-12)
-- =============================================================================
-- Agrega campo para diferenciar si un cliente es de mostrador, reparto, o ambos

-- 1. Agregar columna service_type
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'both'
CHECK (service_type IN ('counter', 'delivery', 'both'));

-- 2. Comentario
COMMENT ON COLUMN customers.service_type IS 
'Tipo de servicio: counter (solo mostrador), delivery (solo reparto), both (ambos)';

-- 3. Índice para filtrar por tipo de servicio
CREATE INDEX IF NOT EXISTS idx_customers_service_type ON customers(service_type);

-- 4. Índice compuesto para rutas (delivery + visit_day)
CREATE INDEX IF NOT EXISTS idx_customers_delivery_day 
ON customers(service_type, visit_day, zone) 
WHERE service_type IN ('delivery', 'both') AND visit_day IS NOT NULL;

-- 5. Migrar datos de sales_channel a service_type (si existe la columna)
DO $$
BEGIN
    -- Verificar si existe la columna sales_channel
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'sales_channel'
    ) THEN
        -- Migrar valores: general -> both, delivery -> delivery, counter -> counter
        UPDATE customers
        SET service_type = CASE 
            WHEN sales_channel = 'general' THEN 'both'
            WHEN sales_channel = 'delivery' THEN 'delivery'
            WHEN sales_channel = 'counter' THEN 'counter'
            ELSE 'both'
        END
        WHERE sales_channel IS NOT NULL;
        
        -- Opcional: Eliminar columna antigua (comentado por seguridad)
        -- ALTER TABLE customers DROP COLUMN IF EXISTS sales_channel;
    END IF;
END $$;

-- 6. Actualizar clientes existentes con business_type (son B2B, probablemente quieren reparto)
UPDATE customers
SET service_type = 'delivery'
WHERE business_type IS NOT NULL AND service_type = 'both';

-- Nota: Los clientes sin business_type quedan como 'both' por defecto (pueden comprar de ambas formas)
