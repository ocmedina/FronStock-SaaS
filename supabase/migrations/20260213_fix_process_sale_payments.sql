-- Fix process_sale function to use correct column name (payment_method instead of method)
-- and include organization_id in sale_payments INSERT

DROP FUNCTION IF EXISTS process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb);

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid,
    p_payments jsonb,
    p_items jsonb,
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
    v_item jsonb;
    v_payment jsonb;
    v_product_id uuid;
    v_quantity numeric;
    v_current_stock numeric;
    v_supplier_id uuid;
    v_supplier_amount numeric;
    v_total numeric := 0;
    v_subtotal numeric := 0;
BEGIN
    -- 1. CALCULAR TOTALES
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_subtotal := v_subtotal + COALESCE(
            (v_item->>'subtotal')::numeric,
            (v_item->>'total')::numeric,
            ((v_item->>'quantity')::numeric * COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric))
        );
    END LOOP;

    v_total := v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_surcharge, 0);

    -- 2. CREAR VENTA
    INSERT INTO sales (
        organization_id,
        customer_id,
        total,
        subtotal,
        discount,
        surcharge,
        status
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_total,
        v_subtotal,
        COALESCE(p_discount, 0),
        COALESCE(p_surcharge, 0),
        'completed'
    ) RETURNING id INTO v_sale_id;

    -- 3. CREAR ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::numeric;

        -- Verificar stock disponible
        SELECT stock INTO v_current_stock
        FROM products
        WHERE id = v_product_id;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto %', v_product_id;
        END IF;

        INSERT INTO sale_items (
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
        ) VALUES (
            v_sale_id,
            v_product_id,
            COALESCE(v_item->>'product_name', v_item->>'name', 'Producto'),
            v_quantity,
            COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric),
            COALESCE((v_item->>'subtotal')::numeric, (v_item->>'total')::numeric, 
                     (v_item->>'quantity')::numeric * COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric))
        );
    END LOOP;

    -- 4. ACTUALIZAR STOCK
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        UPDATE products 
        SET stock = stock - (v_item->>'quantity')::numeric
        WHERE id = (v_item->>'product_id')::uuid
          AND organization_id = p_org_id;
    END LOOP;

    -- 5. REGISTRAR PAGOS (FIXED: usar payment_method y organization_id)
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        INSERT INTO sale_payments (
            sale_id,
            organization_id,
            payment_method,
            amount
        ) VALUES (
            v_sale_id,
            p_org_id,
            v_payment->>'method',
            (v_payment->>'amount')::numeric
        );
    END LOOP;

    -- 6. PROCESAR PAGO A PROVEEDOR
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
            reference_type,
            reference_id
        ) VALUES (
            p_org_id,
            v_supplier_id,
            'payment',
            v_supplier_amount,
            'Pago desde venta',
            'sale',
            v_sale_id
        );

        -- Actualizar saldo actual del proveedor
        UPDATE suppliers
        SET current_balance = GREATEST(current_balance - v_supplier_amount, 0)
        WHERE id = v_supplier_id;
    END IF;

    -- 7. RETORNAR RESULTADO
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total', v_total,
        'success', true
    );
END;
$$;
