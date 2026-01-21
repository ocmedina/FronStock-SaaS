-- =============================================================================
-- FUNCIÓN RPC: process_sale (ACTUALIZADA PARA COMBOS)
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
    v_is_combo boolean;
    v_component RECORD;
    v_comp_stock integer;
BEGIN
    -- Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
    END IF;

    -- 1. VALIDACIÓN DE STOCK
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        
        -- Obtener info del producto
        SELECT stock, is_combo INTO v_current_stock, v_is_combo
        FROM products
        WHERE id = v_product_id
        FOR UPDATE; -- Lock
        
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
        END IF;

        IF v_is_combo THEN
            -- Para combos, validar stock de CADA componente
            FOR v_component IN 
                SELECT child_product_id, quantity 
                FROM product_combos 
                WHERE parent_product_id = v_product_id
            LOOP
                SELECT stock INTO v_comp_stock 
                FROM products 
                WHERE id = v_component.child_product_id;

                IF v_comp_stock < (v_component.quantity * v_quantity) THEN
                    RAISE EXCEPTION 'Stock insuficiente para componente de combo. Producto ID: %', v_component.child_product_id;
                END IF;
            END LOOP;
        ELSE
            -- Producto normal: validar su propio stock
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', 
                    v_product_id, v_current_stock, v_quantity;
            END IF;
        END IF;
        
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := v_subtotal;

    -- 2. VERIFICAR CUENTA CORRIENTE (Si es método 'credit' = Fiado)
    IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
        -- Actualizar balance del cliente
        UPDATE customers 
        SET balance = balance + v_total,
            updated_at = now()
        WHERE id = p_customer_id;

        -- Registrar movimiento
        INSERT INTO customer_account_movements (
            customer_id,
            type,
            amount,
            description
        ) VALUES (
            p_customer_id,
            'charge',
            v_total,
            'Compra Fiado'
        );
    END IF;

    -- 3. INSERTAR VENTA
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
        CASE WHEN p_payment_method = 'credit' THEN 'pending' ELSE 'paid' END,
        'completed'
    ) RETURNING id INTO v_sale_id;

    -- 4. INSERTAR ITEMS Y DESCONTAR STOCK
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_product_name := v_item->>'product_name';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_total := v_unit_price * v_quantity;

        -- Insertar item
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

        -- Descontar Stock
        SELECT is_combo INTO v_is_combo FROM products WHERE id = v_product_id;

        IF v_is_combo THEN
            -- Descontar stock de componentes
            FOR v_component IN 
                SELECT child_product_id, quantity 
                FROM product_combos 
                WHERE parent_product_id = v_product_id
            LOOP
                UPDATE products 
                SET stock = stock - (v_component.quantity * v_quantity),
                    updated_at = now()
                WHERE id = v_component.child_product_id;
            END LOOP;
        ELSE
            -- Descontar stock directo
            UPDATE products 
            SET stock = stock - v_quantity,
                updated_at = now()
            WHERE id = v_product_id;
        END IF;

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
