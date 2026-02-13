-- Migration: Agregar validaciones de límite de crédito y actualización automática de balance
-- Description: Sistema automático para gestionar el balance de proveedores

-- Función para obtener el balance actual de un proveedor
CREATE OR REPLACE FUNCTION get_supplier_balance(p_supplier_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC := 0;
BEGIN
    -- Calcular balance basado en facturas pendientes
    SELECT COALESCE(SUM(total - paid_amount), 0)
    INTO v_balance
    FROM supplier_invoices
    WHERE supplier_id = p_supplier_id
      AND payment_status IN ('pending', 'partial');
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Función para validar límite de crédito al crear una orden
CREATE OR REPLACE FUNCTION check_supplier_credit_limit(
    p_supplier_id UUID,
    p_order_total NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_credit_limit NUMERIC;
    v_current_balance NUMERIC;
    v_available_credit NUMERIC;
    v_supplier_name TEXT;
BEGIN
    -- Obtener datos del proveedor
    SELECT 
        credit_limit, 
        COALESCE(current_balance, 0),
        name
    INTO v_credit_limit, v_current_balance, v_supplier_name
    FROM suppliers
    WHERE id = p_supplier_id;

    IF v_credit_limit IS NULL OR v_credit_limit = 0 THEN
        -- Sin límite de crédito definido
        RETURN jsonb_build_object(
            'valid', true,
            'warning', false,
            'message', 'Sin límite de crédito configurado'
        );
    END IF;

    v_available_credit := v_credit_limit - v_current_balance;

    -- Validar si excede el límite
    IF (v_current_balance + p_order_total) > v_credit_limit THEN
        RETURN jsonb_build_object(
            'valid', false,
            'warning', false,
            'exceeded', true,
            'message', format('Orden excede límite de crédito. Disponible: $%s, Requerido: $%s', 
                v_available_credit::TEXT, p_order_total::TEXT),
            'credit_limit', v_credit_limit,
            'current_balance', v_current_balance,
            'available_credit', v_available_credit,
            'order_total', p_order_total
        );
    END IF;

    -- Advertencia si usa más del 80% del crédito disponible
    IF (v_current_balance + p_order_total) > (v_credit_limit * 0.8) THEN
        RETURN jsonb_build_object(
            'valid', true,
            'warning', true,
            'exceeded', false,
            'message', format('Advertencia: Esta orden usará el %s%% del límite de crédito', 
                ROUND(((v_current_balance + p_order_total) / v_credit_limit * 100)::NUMERIC, 0)::TEXT),
            'credit_limit', v_credit_limit,
            'current_balance', v_current_balance,
            'available_credit', v_available_credit,
            'order_total', p_order_total
        );
    END IF;

    -- Todo OK
    RETURN jsonb_build_object(
        'valid', true,
        'warning', false,
        'exceeded', false,
        'message', 'Orden dentro del límite de crédito',
        'credit_limit', v_credit_limit,
        'current_balance', v_current_balance,
        'available_credit', v_available_credit,
        'order_total', p_order_total
    );
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el balance del proveedor cuando se crea una factura
CREATE OR REPLACE FUNCTION update_supplier_balance_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar balance del proveedor
    UPDATE suppliers
    SET 
        current_balance = get_supplier_balance(NEW.supplier_id),
        updated_at = NOW()
    WHERE id = NEW.supplier_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balance al crear/actualizar facturas
DROP TRIGGER IF EXISTS trigger_update_supplier_balance_invoice ON supplier_invoices;
CREATE TRIGGER trigger_update_supplier_balance_invoice
    AFTER INSERT OR UPDATE OF total, paid_amount, payment_status ON supplier_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_balance_on_invoice();

-- Función para actualizar balance cuando se elimina una factura
CREATE OR REPLACE FUNCTION update_supplier_balance_on_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE suppliers
    SET 
        current_balance = get_supplier_balance(OLD.supplier_id),
        updated_at = NOW()
    WHERE id = OLD.supplier_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balance al eliminar facturas
DROP TRIGGER IF EXISTS trigger_update_supplier_balance_invoice_delete ON supplier_invoices;
CREATE TRIGGER trigger_update_supplier_balance_invoice_delete
    AFTER DELETE ON supplier_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_balance_on_invoice_delete();

-- Agregar columna para rastrear última actualización de balance si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'balance_updated_at'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN balance_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Función mejorada para actualizar balance que también registra última actualización
CREATE OR REPLACE FUNCTION update_supplier_balance_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE suppliers
    SET 
        current_balance = get_supplier_balance(NEW.supplier_id),
        balance_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.supplier_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para recalcular todos los balances (útil para mantenimiento)
CREATE OR REPLACE FUNCTION recalculate_all_supplier_balances()
RETURNS void AS $$
BEGIN
    UPDATE suppliers
    SET 
        current_balance = get_supplier_balance(id),
        balance_updated_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_payment_status 
    ON supplier_invoices(supplier_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_suppliers_credit_limit 
    ON suppliers(credit_limit) WHERE credit_limit > 0;

-- Vista para análisis de crédito de proveedores
CREATE OR REPLACE VIEW supplier_credit_analysis AS
SELECT 
    s.id,
    s.name,
    s.credit_limit,
    s.current_balance,
    s.payment_terms,
    (s.credit_limit - COALESCE(s.current_balance, 0)) as available_credit,
    CASE 
        WHEN s.credit_limit > 0 THEN 
            ROUND((COALESCE(s.current_balance, 0) / s.credit_limit * 100)::NUMERIC, 2)
        ELSE 0 
    END as credit_usage_percent,
    CASE
        WHEN s.credit_limit > 0 AND s.current_balance > s.credit_limit THEN 'exceeded'
        WHEN s.credit_limit > 0 AND (s.current_balance / s.credit_limit) > 0.8 THEN 'warning'
        WHEN s.credit_limit > 0 THEN 'healthy'
        ELSE 'no_limit'
    END as credit_status,
    s.balance_updated_at,
    (SELECT COUNT(*) FROM supplier_invoices 
     WHERE supplier_id = s.id AND payment_status IN ('pending', 'partial')) as pending_invoices_count,
    (SELECT COUNT(*) FROM purchase_orders 
     WHERE supplier_id = s.id AND status IN ('pending', 'ordered')) as pending_orders_count
FROM suppliers s;

COMMENT ON VIEW supplier_credit_analysis IS 'Vista con análisis del estado crediticio de cada proveedor';

