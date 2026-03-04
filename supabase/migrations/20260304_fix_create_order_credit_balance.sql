-- =============================================================================
-- FIX: create_order debe impactar cuenta corriente del cliente
-- Fecha: 2026-03-04
-- =============================================================================

CREATE OR REPLACE FUNCTION create_order(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_items jsonb DEFAULT '[]'::jsonb,
    p_delivery_address text DEFAULT NULL,
    p_delivery_notes text DEFAULT NULL,
    p_estimated_mins integer DEFAULT 30,
    p_delivery_fee numeric DEFAULT 0,
    p_discount numeric DEFAULT 0,
    p_payment_amount numeric DEFAULT NULL,
    p_client_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id uuid;
    v_existing_order_id uuid;
    v_existing_total numeric;
    v_item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_current_stock integer;
    v_subtotal numeric := 0;
    v_total numeric := 0;
    v_product_name text;
    v_unit_price numeric;
    v_item_total numeric;
    v_is_credit boolean := false;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para crear pedidos en esta organización';
    END IF;

    v_is_credit := lower(coalesce(p_payment_method, '')) IN ('credit', 'current_account', 'cuenta_corriente', 'fiado');

    IF p_client_reference IS NOT NULL THEN
        SELECT id, total INTO v_existing_order_id, v_existing_total
        FROM orders
        WHERE organization_id = p_org_id
          AND client_reference = p_client_reference
        LIMIT 1;

        IF v_existing_order_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_order_id,
                'total', v_existing_total,
                'idempotent_replay', true
            );
        END IF;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto';
    END IF;

    IF v_is_credit AND p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Para cuenta corriente debes seleccionar un cliente';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;

        SELECT stock, name INTO v_current_stock, v_product_name
        FROM products
        WHERE id = v_product_id
          AND organization_id = p_org_id
        FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu organización';
        END IF;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para % (Disponible: %, Solicitado: %)',
                v_product_name, v_current_stock, v_quantity;
        END IF;

        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := v_subtotal + p_delivery_fee - p_discount;

    INSERT INTO orders (
        organization_id,
        customer_id,
        subtotal,
        delivery_fee,
        discount,
        total,
        payment_method,
        payment_status,
        delivery_status,
        delivery_address,
        delivery_notes,
        estimated_mins,
        client_reference,
        created_by
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        p_delivery_fee,
        p_discount,
        v_total,
        p_payment_method,
        'pending',
        'pending',
        COALESCE(p_delivery_address, (SELECT address FROM customers WHERE id = p_customer_id LIMIT 1)),
        p_delivery_notes,
        p_estimated_mins,
        p_client_reference,
        auth.uid()
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_product_name := v_item->>'product_name';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_total := v_unit_price * v_quantity;

        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
        ) VALUES (
            v_order_id,
            v_product_id,
            COALESCE(v_product_name, 'Desconocido'),
            v_quantity,
            v_unit_price,
            v_item_total
        );

        UPDATE products
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    IF v_is_credit AND p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET balance = COALESCE(balance, 0) + v_total
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
            NULL,
            'charge',
            v_total,
            'Cargo por pedido delivery #' || left(v_order_id::text, 8)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total', v_total,
        'idempotent_replay', false
    );

EXCEPTION
    WHEN unique_violation THEN
        IF p_client_reference IS NOT NULL THEN
            SELECT id, total INTO v_existing_order_id, v_existing_total
            FROM orders
            WHERE organization_id = p_org_id
              AND client_reference = p_client_reference
            LIMIT 1;

            IF v_existing_order_id IS NOT NULL THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'order_id', v_existing_order_id,
                    'total', v_existing_total,
                    'idempotent_replay', true
                );
            END IF;
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION register_order_payment(
    p_org_id uuid,
    p_order_id uuid,
    p_method text,
    p_amount numeric,
    p_reference text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_paid_total numeric;
    v_new_payment_status text;
    v_should_reduce_customer_balance boolean := false;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Monto inválido');
    END IF;

    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
        AND organization_id = p_org_id
    LIMIT 1;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    INSERT INTO order_payments (
        organization_id,
        order_id,
        method,
        amount,
        reference,
        notes,
        paid_by
    ) VALUES (
        p_org_id,
        p_order_id,
        p_method,
        p_amount,
        p_reference,
        p_notes,
        auth.uid()
    );

    SELECT COALESCE(SUM(amount), 0)
    INTO v_paid_total
    FROM order_payments
    WHERE organization_id = p_org_id
        AND order_id = p_order_id;

    v_new_payment_status := CASE
        WHEN v_paid_total >= COALESCE(v_order.total, 0) THEN 'paid'
        WHEN v_paid_total > 0 THEN 'partial'
        ELSE 'pending'
    END;

    UPDATE orders
    SET
        payment_status = v_new_payment_status,
        payment_method = COALESCE(payment_method, p_method),
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO order_events (
        organization_id,
        order_id,
        event_type,
        payload,
        notes,
        created_by
    ) VALUES (
        p_org_id,
        p_order_id,
        'payment_registered',
        jsonb_build_object('method', p_method, 'amount', p_amount, 'paid_total', v_paid_total),
        p_notes,
        auth.uid()
    );

    v_should_reduce_customer_balance :=
        v_order.customer_id IS NOT NULL
        AND lower(coalesce(v_order.payment_method, '')) IN ('credit', 'current_account', 'cuenta_corriente', 'fiado');

    IF v_should_reduce_customer_balance THEN
        UPDATE customers
        SET balance = GREATEST(0, COALESCE(balance, 0) - p_amount)
        WHERE id = v_order.customer_id
            AND organization_id = p_org_id;

        INSERT INTO customer_account_movements (
            customer_id,
            organization_id,
            sale_id,
            type,
            amount,
            description
        ) VALUES (
            v_order.customer_id,
            p_org_id,
            NULL,
            'payment',
            p_amount,
            COALESCE(p_notes, 'Pago de pedido delivery #' || left(v_order.id::text, 8))
        );
    END IF;

    IF p_method = 'cash' THEN
        UPDATE delivery_shifts
        SET collected_cash = collected_cash + p_amount
        WHERE driver_id = auth.uid()
            AND organization_id = p_org_id
            AND status = 'active';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'paid_total', v_paid_total,
        'payment_status', v_new_payment_status
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION register_order_payment(uuid, uuid, text, numeric, text, text) TO authenticated;
