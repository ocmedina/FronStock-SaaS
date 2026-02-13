-- =============================================================================
-- MIGRACIÓN: IDEMPOTENCIA PARA CREATE_ORDER (2026-02-13)
-- =============================================================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS client_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_org_client_reference_unique
ON orders(organization_id, client_reference)
WHERE client_reference IS NOT NULL;

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
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para crear pedidos en esta organización';
    END IF;

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
