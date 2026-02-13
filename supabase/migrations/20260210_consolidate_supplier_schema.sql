-- =====================================================
-- Migración: Consolidación de Esquema de Proveedores + Datos Maestros
-- Fecha: 2026-02-10
-- Descripción: Consolida campos conflictivos y agrega datos maestros completos
-- =====================================================

-- ============================================
-- PARTE 1: CONSOLIDACIÓN DE CAMPOS EXISTENTES
-- ============================================

-- 1. Unificar balance: Migrar 'balance' a 'current_balance'
-- Actualizar current_balance con el valor de balance si existe
UPDATE suppliers 
SET current_balance = COALESCE(balance, 0) 
WHERE balance IS NOT NULL AND current_balance = 0;

-- Eliminar columna 'balance' obsoleta
ALTER TABLE suppliers DROP COLUMN IF EXISTS balance;

COMMENT ON COLUMN suppliers.current_balance IS 'Balance actual consolidado (positivo = debemos al proveedor)';

-- ============================================
-- PARTE 2: DATOS MAESTROS
-- ============================================

-- 2. Agregar campos de identificación y datos legales
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_id_type VARCHAR(20) DEFAULT 'CUIT',
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

COMMENT ON COLUMN suppliers.legal_name IS 'Razón Social (nombre legal para facturación)';
COMMENT ON COLUMN suppliers.trade_name IS 'Nombre Fantasía (nombre comercial)';
COMMENT ON COLUMN suppliers.tax_id IS 'CUIT/RUT/DNI - Identificación fiscal única';
COMMENT ON COLUMN suppliers.tax_id_type IS 'Tipo de identificación: CUIT, RUT, DNI, Pasaporte, Otro';
COMMENT ON COLUMN suppliers.category IS 'Categoría/Rubro del proveedor';

-- 3. Agregar direcciones separadas
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS administrative_address TEXT,
ADD COLUMN IF NOT EXISTS warehouse_address TEXT;

COMMENT ON COLUMN suppliers.administrative_address IS 'Dirección administrativa/facturación';
COMMENT ON COLUMN suppliers.warehouse_address IS 'Dirección de depósito/retiro de mercadería';

-- ============================================
-- PARTE 3: CONDICIONES COMERCIALES
-- ============================================

-- 4. Agregar condiciones de pago
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS default_payment_condition VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_days INTEGER,
ADD COLUMN IF NOT EXISTS requires_advance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS advance_percentage DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN suppliers.default_payment_condition IS 'Condición de pago por defecto (Contado, 30 días, etc.)';
COMMENT ON COLUMN suppliers.payment_days IS 'Días de pago acordados (complementa payment_terms)';
COMMENT ON COLUMN suppliers.requires_advance IS 'Indica si requiere pago de anticipo';
COMMENT ON COLUMN suppliers.advance_percentage IS 'Porcentaje de anticipo requerido (0-100)';

-- 5. Agregar datos bancarios
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_cbu_alias VARCHAR(100);

COMMENT ON COLUMN suppliers.bank_name IS 'Nombre del banco';
COMMENT ON COLUMN suppliers.bank_account_number IS 'Número de cuenta bancaria';
COMMENT ON COLUMN suppliers.bank_cbu_alias IS 'CBU o Alias para transferencias';

-- 6. Agregar lead time
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

COMMENT ON COLUMN suppliers.lead_time_days IS 'Días de entrega promedio (lead time)';

-- ============================================
-- PARTE 4: MIGRACIÓN DE DATOS EXISTENTES
-- ============================================

-- 7. Migrar datos existentes
-- Copiar 'name' actual a 'legal_name' para proveedores existentes
UPDATE suppliers 
SET legal_name = name 
WHERE legal_name IS NULL;

-- Copiar 'address' actual a 'administrative_address' si existe
UPDATE suppliers 
SET administrative_address = address 
WHERE address IS NOT NULL AND administrative_address IS NULL;

-- Copiar payment_terms a payment_days si existe
UPDATE suppliers 
SET payment_days = payment_terms 
WHERE payment_terms IS NOT NULL AND payment_days IS NULL;

-- ============================================
-- PARTE 5: CONSTRAINTS Y VALIDACIONES
-- ============================================

-- 8. Crear índice único para tax_id por organización
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_tax_id_org 
ON suppliers(tax_id, organization_id) 
WHERE tax_id IS NOT NULL AND tax_id <> '';

-- 9. Agregar constraints de validación
ALTER TABLE suppliers
DROP CONSTRAINT IF EXISTS chk_advance_percentage,
ADD CONSTRAINT chk_advance_percentage CHECK (advance_percentage >= 0 AND advance_percentage <= 100);

ALTER TABLE suppliers
DROP CONSTRAINT IF EXISTS chk_lead_time,
ADD CONSTRAINT chk_lead_time CHECK (lead_time_days >= 0);

-- 10. Índices adicionales para búsqueda
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_legal_name ON suppliers(legal_name) WHERE legal_name IS NOT NULL;

-- ============================================
-- PARTE 6: ACTUALIZAR FUNCIÓN process_sale
-- ============================================

-- 11. Actualizar función process_sale para usar current_balance
CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payments jsonb DEFAULT '[]'::jsonb,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_discount numeric DEFAULT 0,
    p_surcharge numeric DEFAULT 0,
    p_supplier_payment jsonb DEFAULT NULL
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id uuid;
    v_sale_number integer;
    v_subtotal numeric := 0;
    v_total numeric := 0;
    v_item jsonb;
    v_payment jsonb;
    v_product_price numeric;
    v_current_stock numeric;
    v_final_item_price numeric;
    v_has_credit boolean := false;
    v_main_payment_method text := 'mixed';
    v_supplier_id uuid;
    v_supplier_amount numeric;
BEGIN
    -- 1. VALIDACIONES BÁSICAS
    IF jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El carrito está vacío');
    END IF;

    -- Calcular Totales e Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT price, stock INTO v_product_price, v_current_stock
        FROM products 
        WHERE id = (v_item->>'product_id')::uuid 
        AND organization_id = p_org_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado: ' || (v_item->>'product_name'));
        END IF;

        IF v_current_stock < (v_item->>'quantity')::numeric THEN
            RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente para: ' || (v_item->>'product_name'));
        END IF;

        v_final_item_price := COALESCE((v_item->>'unit_price')::numeric, v_product_price);
        v_subtotal := v_subtotal + (v_final_item_price * (v_item->>'quantity')::numeric);
    END LOOP;

    v_total := v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_surcharge, 0);

    -- Determinar método de pago principal
    IF jsonb_array_length(p_payments) = 1 THEN
        v_main_payment_method := p_payments->0->>'method';
    ELSE
        v_main_payment_method := 'mixed';
    END IF;

    -- Verificar si hay crédito
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        IF (v_payment->>'method') = 'credit' THEN
            v_has_credit := true;
        END IF;
    END LOOP;

    IF v_has_credit AND p_customer_id IS NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'Se requiere cliente para pagos a crédito');
    END IF;

    -- 2. OBTENER SIGUIENTE NÚMERO DE VENTA
    SELECT COALESCE(MAX(sale_number), 0) + 1 INTO v_sale_number
    FROM sales
    WHERE organization_id = p_org_id;

    -- 3. INSERTAR VENTA
    INSERT INTO sales (
        organization_id,
        customer_id,
        subtotal,
        total,
        discount,
        surcharge,
        payment_method,
        payment_status,
        status,
        sale_number
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        COALESCE(p_discount, 0),
        COALESCE(p_surcharge, 0),
        v_main_payment_method,
        CASE WHEN v_has_credit THEN 'pending' ELSE 'paid' END,
        'completed',
        v_sale_number
    ) RETURNING id INTO v_sale_id;

    -- 4. INSERTAR ITEMS Y ACTUALIZAR STOCK
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            total,
            product_name
        ) VALUES (
            v_sale_id,
            (v_item->>'product_id')::uuid,
            (v_item->>'quantity')::numeric,
            (v_item->>'unit_price')::numeric,
            ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric),
            v_item->>'product_name'
        );

        UPDATE products 
        SET stock = stock - (v_item->>'quantity')::numeric
        WHERE id = (v_item->>'product_id')::uuid;
    END LOOP;

    -- 5. REGISTRAR PAGOS
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        INSERT INTO sale_payments (
            sale_id,
            method,
            amount
        ) VALUES (
            v_sale_id,
            v_payment->>'method',
            (v_payment->>'amount')::numeric
        );
    END LOOP;

    -- 6. PROCESAR PAGO A PROVEEDOR (ACTUALIZADO: usa current_balance)
    IF p_supplier_payment IS NOT NULL AND (p_supplier_payment->>'amount')::numeric > 0 THEN
        v_supplier_id := (p_supplier_payment->>'supplier_id')::uuid;
        v_supplier_amount := (p_supplier_payment->>'amount')::numeric;

        -- Registrar Movimiento
        INSERT INTO supplier_account_movements (
            organization_id,
            supplier_id,
            type,
            amount,
            description,
            sale_id,
            created_by
        ) VALUES (
            p_org_id,
            v_supplier_id,
            'payment',
            v_supplier_amount,
            'Pago desde Venta #' || v_sale_number,
            v_sale_id,
            auth.uid()
        );

        -- ACTUALIZADO: Usar current_balance en lugar de balance
        UPDATE suppliers
        SET current_balance = current_balance - v_supplier_amount
        WHERE id = v_supplier_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_number', v_sale_number,
        'total', v_total
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- ============================================
-- PARTE 7: VERIFICACIÓN
-- ============================================

-- 12. Verificar que la migración fue exitosa
DO $$
BEGIN
    RAISE NOTICE 'Migración completada exitosamente';
    RAISE NOTICE 'Campos agregados: legal_name, trade_name, tax_id, category, etc.';
    RAISE NOTICE 'Campo balance eliminado, current_balance consolidado';
    RAISE NOTICE 'Función process_sale actualizada';
END $$;
