-- =============================================================================
-- MIGRACIÓN: CLIENTES B2B - CAMPOS COMERCIALES (2026-02-12)
-- =============================================================================
-- Extiende la tabla customers para soportar clientes comerciales/negocios
-- en lugar de solo consumidores finales

-- 1. Agregar campos B2B a customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS business_type text, -- 'kiosko', 'restaurant', 'hotel', 'supermercado', 'bar', etc
ADD COLUMN IF NOT EXISTS tax_id text, -- CUIT para Argentina
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0, -- Saldo cuenta corriente (negativo = debe, positivo = favor)
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0, -- Límite de crédito permitido
ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'contado', -- 'contado', '7_dias', '15_dias', '30_dias', '60_dias'
ADD COLUMN IF NOT EXISTS price_list text DEFAULT 'default', -- 'default', 'mayorista', 'minorista', 'especial'
ADD COLUMN IF NOT EXISTS zone text, -- 'norte', 'sur', 'este', 'oeste', 'centro' - Zona geográfica
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true, -- Si el cliente está activo
ADD COLUMN IF NOT EXISTS contact_person text, -- Persona de contacto en el negocio
ADD COLUMN IF NOT EXISTS business_hours text, -- 'Lun-Vie 8-18hs', etc
ADD COLUMN IF NOT EXISTS notes text, -- Notas importantes del cliente
ADD COLUMN IF NOT EXISTS last_visit_date timestamptz, -- Última vez que lo visitaron
ADD COLUMN IF NOT EXISTS preferred_visit_time time; -- Hora preferida de visita (ej: 09:00)

-- 2. Comentarios para documentación
COMMENT ON COLUMN customers.business_type IS 'Tipo de negocio del cliente B2B';
COMMENT ON COLUMN customers.tax_id IS 'CUIT o identificación fiscal';
COMMENT ON COLUMN customers.balance IS 'Saldo de cuenta corriente. Negativo = cliente debe, Positivo = a favor del cliente';
COMMENT ON COLUMN customers.credit_limit IS 'Monto máximo que puede deber el cliente';
COMMENT ON COLUMN customers.payment_terms IS 'Condiciones de pago acordadas';
COMMENT ON COLUMN customers.price_list IS 'Lista de precios aplicable para este cliente';
COMMENT ON COLUMN customers.zone IS 'Zona geográfica para organización de rutas';
COMMENT ON COLUMN customers.visit_day IS 'Día de la semana de visita (0=Domingo, 1=Lunes, ..., 6=Sábado)';
COMMENT ON COLUMN customers.route_order IS 'Orden de visita dentro de la ruta del día';

-- 3. Índices para búsquedas y reportes
CREATE INDEX IF NOT EXISTS idx_customers_zone ON customers(zone) WHERE zone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(balance) WHERE balance < 0; -- Clientes con deuda
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_price_list ON customers(price_list);
CREATE INDEX IF NOT EXISTS idx_customers_tax_id ON customers(tax_id) WHERE tax_id IS NOT NULL;

-- 4. Constraint para balance vs credit_limit
-- Un cliente no puede deber más que su límite (con tolerancia)
ALTER TABLE customers
ADD CONSTRAINT check_credit_limit 
CHECK (balance >= -credit_limit - 1000); -- Tolerancia de $1000 por errores de redondeo

-- 5. Trigger para actualizar last_visit_date automáticamente
CREATE OR REPLACE FUNCTION update_customer_last_visit()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se cree una venta para este cliente
    UPDATE customers 
    SET last_visit_date = NEW.created_at
    WHERE id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_last_visit ON sales;
CREATE TRIGGER trigger_update_customer_last_visit
    AFTER INSERT ON sales
    FOR EACH ROW
    WHEN (NEW.customer_id IS NOT NULL)
    EXECUTE FUNCTION update_customer_last_visit();

-- 6. Función auxiliar: Validar crédito disponible
CREATE OR REPLACE FUNCTION get_available_credit(p_customer_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance numeric;
    v_limit numeric;
BEGIN
    SELECT balance, credit_limit
    INTO v_balance, v_limit
    FROM customers
    WHERE id = p_customer_id;
    
    -- Crédito disponible = límite + balance (si balance es negativo, resta del límite)
    RETURN v_limit + v_balance;
END;
$$;

COMMENT ON FUNCTION get_available_credit IS 'Retorna cuánto crédito le queda disponible al cliente';

-- 7. Vista útil: Clientes con deuda
CREATE OR REPLACE VIEW customers_with_debt AS
SELECT 
    c.id,
    c.name,
    c.business_type,
    c.tax_id,
    c.balance,
    c.credit_limit,
    (c.credit_limit + c.balance) as available_credit,
    c.payment_terms,
    c.phone,
    c.zone,
    c.last_visit_date,
    c.organization_id
FROM customers c
WHERE c.balance < 0
ORDER BY c.balance ASC; -- Los que más deben primero

COMMENT ON VIEW customers_with_debt IS 'Clientes con saldo negativo (deuda)';
