-- =====================================================
-- Migración: Automatización de Pagos a Proveedores
-- Fecha: 2026-02-10
-- Descripción: Funciones y vistas para cálculo de anticipos y alertas
-- =====================================================

-- ============================================
-- PARTE 1: FUNCIÓN DE CÁLCULO DE ANTICIPOS
-- ============================================

-- Función para calcular anticipos automáticamente
CREATE OR REPLACE FUNCTION calculate_supplier_advance(
    p_invoice_id uuid,
    p_supplier_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_supplier record;
    v_invoice record;
    v_advance_amount numeric;
    v_balance_amount numeric;
    v_due_date date;
BEGIN
    -- Obtener datos del proveedor
    SELECT * INTO v_supplier 
    FROM suppliers 
    WHERE id = p_supplier_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proveedor no encontrado';
    END IF;
    
    -- Obtener datos de la factura
    SELECT * INTO v_invoice 
    FROM supplier_invoices 
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada';
    END IF;
    
    -- Calcular fecha de vencimiento
    v_due_date := v_invoice.invoice_date + COALESCE(v_supplier.payment_days, 30);
    
    -- Calcular anticipo si es requerido
    IF v_supplier.requires_advance THEN
        v_advance_amount := ROUND(v_invoice.total_amount * (v_supplier.advance_percentage / 100), 2);
        v_balance_amount := v_invoice.total_amount - v_advance_amount;
        
        RETURN jsonb_build_object(
            'requires_advance', true,
            'total_amount', v_invoice.total_amount,
            'advance_amount', v_advance_amount,
            'balance_amount', v_balance_amount,
            'advance_percentage', v_supplier.advance_percentage,
            'payment_days', COALESCE(v_supplier.payment_days, 30),
            'due_date', v_due_date,
            'supplier_info', jsonb_build_object(
                'name', v_supplier.name,
                'legal_name', v_supplier.legal_name,
                'tax_id', v_supplier.tax_id
            ),
            'bank_info', jsonb_build_object(
                'bank_name', v_supplier.bank_name,
                'account_number', v_supplier.bank_account_number,
                'cbu_alias', v_supplier.bank_cbu_alias
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'requires_advance', false,
            'total_amount', v_invoice.total_amount,
            'payment_days', COALESCE(v_supplier.payment_days, 30),
            'due_date', v_due_date,
            'supplier_info', jsonb_build_object(
                'name', v_supplier.name,
                'legal_name', v_supplier.legal_name,
                'tax_id', v_supplier.tax_id
            ),
            'bank_info', jsonb_build_object(
                'bank_name', v_supplier.bank_name,
                'account_number', v_supplier.bank_account_number,
                'cbu_alias', v_supplier.bank_cbu_alias
            )
        );
    END IF;
END;
$$;

-- ============================================
-- PARTE 2: VISTA DE FACTURAS PENDIENTES
-- ============================================

-- Vista para facturas con alertas de vencimiento
CREATE OR REPLACE VIEW supplier_invoices_due AS
SELECT 
    si.id,
    si.supplier_id,
    si.invoice_number,
    si.invoice_date,
    si.due_date,
    si.total_amount,
    si.paid_amount,
    si.status,
    si.organization_id,
    s.name as supplier_name,
    s.legal_name as supplier_legal_name,
    s.tax_id as supplier_tax_id,
    s.contact_name as supplier_contact,
    s.phone as supplier_phone,
    s.email as supplier_email,
    s.bank_name,
    s.bank_account_number,
    s.bank_cbu_alias,
    s.requires_advance,
    s.advance_percentage,
    (si.total_amount - COALESCE(si.paid_amount, 0)) as pending_amount,
    CASE 
        WHEN si.due_date < CURRENT_DATE THEN 'overdue'
        WHEN si.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'due_soon'
        WHEN si.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'upcoming'
        ELSE 'pending'
    END as urgency_status,
    (CURRENT_DATE - si.due_date) as days_overdue,
    (si.due_date - CURRENT_DATE) as days_until_due
FROM supplier_invoices si
JOIN suppliers s ON s.id = si.supplier_id
WHERE si.status IN ('pending', 'partial')
ORDER BY 
    CASE 
        WHEN si.due_date < CURRENT_DATE THEN 1
        WHEN si.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 2
        WHEN si.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 3
        ELSE 4
    END,
    si.due_date ASC;

-- ============================================
-- PARTE 3: FUNCIÓN PARA REGISTRAR PAGO CON ANTICIPO
-- ============================================

-- Función para registrar pago de factura (con soporte de anticipo)
CREATE OR REPLACE FUNCTION register_supplier_invoice_payment(
    p_invoice_id uuid,
    p_amount numeric,
    p_payment_method varchar,
    p_payment_date date DEFAULT CURRENT_DATE,
    p_reference text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_is_advance boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice record;
    v_payment_id uuid;
    v_new_paid_amount numeric;
    v_new_status varchar;
BEGIN
    -- Obtener factura
    SELECT * INTO v_invoice FROM supplier_invoices WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura no encontrada';
    END IF;
    
    -- Validar monto
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;
    
    IF (COALESCE(v_invoice.paid_amount, 0) + p_amount) > v_invoice.total_amount THEN
        RAISE EXCEPTION 'El monto excede el total de la factura';
    END IF;
    
    -- Registrar pago
    INSERT INTO supplier_invoice_payments (
        invoice_id,
        amount,
        payment_method,
        payment_date,
        reference,
        notes,
        organization_id
    ) VALUES (
        p_invoice_id,
        p_amount,
        p_payment_method,
        p_payment_date,
        p_reference,
        CASE 
            WHEN p_is_advance THEN CONCAT('ANTICIPO - ', COALESCE(p_notes, ''))
            ELSE p_notes
        END,
        v_invoice.organization_id
    ) RETURNING id INTO v_payment_id;
    
    -- Actualizar monto pagado de la factura
    v_new_paid_amount := COALESCE(v_invoice.paid_amount, 0) + p_amount;
    
    -- Determinar nuevo estado
    IF v_new_paid_amount >= v_invoice.total_amount THEN
        v_new_status := 'paid';
    ELSIF v_new_paid_amount > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'pending';
    END IF;
    
    -- Actualizar factura
    UPDATE supplier_invoices
    SET 
        paid_amount = v_new_paid_amount,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'invoice_id', p_invoice_id,
        'amount_paid', p_amount,
        'total_paid', v_new_paid_amount,
        'remaining', v_invoice.total_amount - v_new_paid_amount,
        'status', v_new_status,
        'is_advance', p_is_advance
    );
END;
$$;

-- ============================================
-- PARTE 4: ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índice para búsquedas por fecha de vencimiento
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date 
ON supplier_invoices(due_date) 
WHERE status IN ('pending', 'partial');

-- Índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status 
ON supplier_invoices(status);

-- Índice para búsquedas por proveedor y estado
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_status 
ON supplier_invoices(supplier_id, status);

-- ============================================
-- PARTE 5: COMENTARIOS
-- ============================================

COMMENT ON FUNCTION calculate_supplier_advance IS 
'Calcula automáticamente el anticipo requerido para una factura de proveedor basado en las condiciones comerciales del proveedor';

COMMENT ON VIEW supplier_invoices_due IS 
'Vista de facturas pendientes con información de urgencia y días de vencimiento';

COMMENT ON FUNCTION register_supplier_invoice_payment IS 
'Registra un pago de factura de proveedor, actualizando el estado y balance automáticamente';
