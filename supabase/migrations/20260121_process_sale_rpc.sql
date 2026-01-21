-- =============================================================================
-- FUNCIÓN RPC: process_sale
-- Procesa una venta de forma atómica (todo o nada)
-- =============================================================================
-- 
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase Dashboard
-- 2. Ve a SQL Editor
-- 3. Pega y ejecuta este script
-- =============================================================================

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_items jsonb DEFAULT '[]'::jsonb
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
BEGIN
    -- Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
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
        
        -- Acumular totales
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := v_subtotal;

    -- Insertar la venta
    INSERT INTO sales (
        organization_id,
        customer_id,
        subtotal,
        total,
        payment_method,
        payment_status,
        status
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        p_payment_method,
        'paid',
        'completed'
    ) RETURNING id INTO v_sale_id;

    -- Insertar items y actualizar stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_product_name := v_item->>'product_name';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_total := v_unit_price * v_quantity;

        -- Insertar item de venta
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

        -- Actualizar stock
        UPDATE products 
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    -- Retornar información de la venta
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'total', v_total,
        'items_count', jsonb_array_length(p_items)
    );

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, toda la transacción se revierte automáticamente
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Dar permisos para que los usuarios autenticados puedan ejecutar la función
GRANT EXECUTE ON FUNCTION process_sale TO authenticated;

-- =============================================================================
-- PRUEBA (opcional - descomenta para probar)
-- =============================================================================
-- SELECT process_sale(
--     'tu-org-id-aqui'::uuid,
--     NULL,
--     'cash',
--     '[{"product_id": "tu-product-id", "product_name": "Test", "quantity": 1, "unit_price": 100}]'::jsonb
-- );
