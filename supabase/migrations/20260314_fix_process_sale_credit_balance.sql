-- Ensure POS credit sales update customer current account balance and movements
-- This keeps fiado/cuenta corriente consistent with delivery credit behavior.

DROP FUNCTION IF EXISTS process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text);

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid,
    p_payments jsonb,
    p_items jsonb,
    p_discount numeric DEFAULT 0,
    p_surcharge numeric DEFAULT 0,
    p_supplier_payment jsonb DEFAULT NULL,
    p_client_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id uuid;
    v_existing_sale_id uuid;
    v_existing_total numeric;
    v_item jsonb;
    v_payment jsonb;
    v_product_id uuid;
    v_quantity numeric;
    v_current_stock numeric;
    v_supplier_id uuid;
    v_supplier_amount numeric;
    v_total numeric := 0;
    v_subtotal numeric := 0;
    v_main_payment_method text := 'cash';
    v_has_credit boolean := false;
    v_credit_amount numeric := 0;
BEGIN
    -- 0. IDEMPOTENCY CHECK
    IF p_client_reference IS NOT NULL AND length(trim(p_client_reference)) > 0 THEN
        SELECT id, total
        INTO v_existing_sale_id, v_existing_total
        FROM sales
        WHERE organization_id = p_org_id
          AND client_reference = p_client_reference
        LIMIT 1;

        IF v_existing_sale_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'sale_id', v_existing_sale_id,
                'total', v_existing_total,
                'success', true,
                'already_exists', true
            );
        END IF;
    END IF;

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

    -- Resolver método de pago principal y estado de pago
    IF COALESCE(jsonb_array_length(p_payments), 0) = 1 THEN
        v_main_payment_method := COALESCE(p_payments->0->>'method', 'cash');
    ELSIF COALESCE(jsonb_array_length(p_payments), 0) > 1 THEN
        v_main_payment_method := 'mixed';
    END IF;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
    LOOP
        IF lower(COALESCE(v_payment->>'method', '')) IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
            v_has_credit := true;
            v_credit_amount := v_credit_amount + COALESCE((v_payment->>'amount')::numeric, 0);
        END IF;
    END LOOP;

    -- Fallback de seguridad para payloads legacy: si hay crédito pero sin amount claro, tomar total.
    IF v_has_credit AND v_credit_amount <= 0 THEN
        v_credit_amount := v_total;
    END IF;

    -- 2. CREAR VENTA
    INSERT INTO sales (
        organization_id,
        customer_id,
        total,
        subtotal,
        discount,
        surcharge,
        status,
        payment_method,
        payment_status,
        client_reference
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_total,
        v_subtotal,
        COALESCE(p_discount, 0),
        COALESCE(p_surcharge, 0),
        'completed',
        v_main_payment_method,
        CASE WHEN v_has_credit THEN 'pending' ELSE 'paid' END,
        NULLIF(trim(p_client_reference), '')
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

    -- 5. REGISTRAR PAGOS
    FOR v_payment IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
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

    -- 6. IMPACTAR CUENTA CORRIENTE DE CLIENTE PARA FIADO
    IF v_has_credit AND p_customer_id IS NOT NULL AND v_credit_amount > 0 THEN
        UPDATE customers
        SET balance = COALESCE(balance, 0) + v_credit_amount
        WHERE id = p_customer_id
          AND organization_id = p_org_id;

        INSERT INTO customer_account_movements (
            customer_id,
            organization_id,
            sale_id,
            type,
            amount,
            description
        ) VALUES (
            p_customer_id,
            p_org_id,
            v_sale_id,
            'charge',
            v_credit_amount,
            'Cargo por venta #' || left(v_sale_id::text, 8)
        );
    END IF;

    -- 7. PROCESAR PAGO A PROVEEDOR
    IF p_supplier_payment IS NOT NULL AND (p_supplier_payment->>'amount')::numeric > 0 THEN
        v_supplier_id := (p_supplier_payment->>'supplier_id')::uuid;
        v_supplier_amount := (p_supplier_payment->>'amount')::numeric;

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

        UPDATE suppliers
        SET current_balance = GREATEST(current_balance - v_supplier_amount, 0)
        WHERE id = v_supplier_id;
    END IF;

    -- 8. RETORNAR RESULTADO
    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total', v_total,
        'success', true,
        'already_exists', false
    );
END;
$$;
