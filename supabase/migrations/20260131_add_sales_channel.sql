
-- =============================================================================
-- MIGRACIÓN: CANAL DE VENTA (2026-01-31)
-- =============================================================================

-- 1. Agregar columna channel a sales
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS channel text DEFAULT 'pos' CHECK (channel IN ('pos', 'delivery', 'online'));

-- 2. Indexar para filtrado rápido
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);

-- 3. Actualizar RPC process_sale para aceptar channel
CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_items jsonb DEFAULT '[]'::jsonb,
    p_delivery_status text DEFAULT 'delivered',
    p_payment_status text DEFAULT 'paid',
    p_assigned_to uuid DEFAULT NULL,
    p_delivery_address text DEFAULT NULL,
    p_delivery_notes text DEFAULT NULL,
    p_discount numeric DEFAULT 0,
    p_channel text DEFAULT 'pos' -- Nuevo parámetro
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id uuid;
    v_item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_current_stock integer;
    v_subtotal numeric := 0;
    v_total numeric := 0;
    v_product_name text;
    v_unit_price numeric;
    v_item_total numeric;
    v_customer_balance numeric;
BEGIN
    -- Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
    END IF;

    -- Validar cliente para fiado
    IF p_payment_status = 'pending' AND p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Se requiere un cliente registrado para ventas fiadas (Cuenta Corriente).';
    END IF;

    -- Iterar items para validar stock y calcular totales
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        
        -- Validar que el producto existe y tiene stock suficiente
        SELECT stock INTO v_current_stock
        FROM products
        WHERE id = v_product_id
        FOR UPDATE; -- Lock para evitar race conditions
        
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
        END IF;
        
        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', 
                v_product_id, v_current_stock, v_quantity;
        END IF;
        
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := v_subtotal - p_discount;

    -- Insertar la venta
    INSERT INTO sales (
        organization_id,
        customer_id,
        subtotal,
        total,
        payment_method,
        payment_status,
        status,
        delivery_status,
        assigned_to,
        delivery_address,
        delivery_date,
        channel, -- Insertar canal
        delivery_notes
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        p_payment_method,
        p_payment_status,
        'completed',
        p_delivery_status,
        p_assigned_to,
        COALESCE(p_delivery_address, (SELECT address FROM customers WHERE id = p_customer_id LIMIT 1)),
        now(),
        p_channel, -- Usar el valor pasado o default 'pos'
        p_delivery_notes
    ) RETURNING id INTO v_sale_id;

    -- Actualizar saldo del cliente si es fiado
    IF p_payment_status = 'pending' AND p_customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = COALESCE(balance, 0) - v_total
        WHERE id = p_customer_id;
    END IF;

    -- Insertar items y actualizar stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_product_name := v_item->>'product_name';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_total := v_unit_price * v_quantity;

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
            COALESCE(v_product_name, 'Sin nombre'),
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
        'sale_id', v_sale_id,
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
