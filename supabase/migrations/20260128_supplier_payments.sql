-- 1. Agregar columna balance a suppliers si no existe
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;

-- 2. Crear tabla de movimientos de cuenta corriente
CREATE TABLE IF NOT EXISTS supplier_account_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id),
    supplier_id uuid REFERENCES suppliers(id),
    type text NOT NULL CHECK (type IN ('purchase', 'payment', 'adjustment')),
    amount numeric NOT NULL,
    description text,
    sale_id uuid REFERENCES sales(id), -- Opcional, si viene de una venta
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES profiles(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_supplier_movements_supplier ON supplier_account_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_movements_org ON supplier_account_movements(organization_id);

-- 3. Actualizar función process_sale para aceptar pago a proveedor
-- Eliminar versiones anteriores (con 6 y 7 parámetros por si acaso)
DROP FUNCTION IF EXISTS process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric);
DROP FUNCTION IF EXISTS process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb);

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payments jsonb DEFAULT '[]'::jsonb,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_discount numeric DEFAULT 0,
    p_surcharge numeric DEFAULT 0,
    p_supplier_payment jsonb DEFAULT NULL -- Nuevo parámetro: { supplier_id, amount }
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
        -- Obtener precio actual y stock
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

    -- Aplicar Descuentos/Recargos
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

        -- Descontar stock
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
        
        -- Si es crédito, actualizar cuenta corriente del cliente (Esto asume que existe la lógica o tabla, por ahora lo dejamos simple)
        -- TODO: Actualizar balance de cliente si aplica
    END LOOP;

    -- 6. PROCESAR PAGO A PROVEEDOR (NUEVO)
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

        -- Actualizar Balance del Proveedor (Resta deuda)
        UPDATE suppliers
        SET balance = balance - v_supplier_amount
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
