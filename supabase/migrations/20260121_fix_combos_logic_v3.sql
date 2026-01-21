-- =============================================================================
-- ARREGLO DEFINITIVO: Lógica de Stock en Combos
-- =============================================================================

-- 1. Primero borramos la función existente para asegurar que se reemplace
DROP FUNCTION IF EXISTS process_sale(uuid, uuid, text, jsonb);

-- 2. Creamos la función nueva
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
    -- Validar items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
    END IF;

    -- ========================================================================
    -- A. VALIDACIÓN PREVIA DE STOCK
    -- ========================================================================
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        
        -- Verificar si es combo
        SELECT is_combo, stock INTO v_is_combo, v_current_stock
        FROM products WHERE id = v_product_id;

        IF v_is_combo IS TRUE THEN
            -- SI ES COMBO: Validar stock de sus componentes
            FOR v_component IN 
                SELECT child_product_id, quantity 
                FROM product_combos 
                WHERE parent_product_id = v_product_id
            LOOP
                SELECT stock INTO v_comp_stock FROM products WHERE id = v_component.child_product_id;
                
                IF v_comp_stock < (v_component.quantity * v_quantity) THEN
                    RAISE EXCEPTION 'No hay suficiente stock del componente (ID: %) para armar el combo', v_component.child_product_id;
                END IF;
            END LOOP;
        ELSE
            -- SI ES PRODUCTO SIMPLE: Validar su stock directo
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para el producto %', v_product_id;
            END IF;
        END IF;
        
        -- Sumar al total
        v_subtotal := v_subtotal + ((v_item->>'unit_price')::numeric * v_quantity);
    END LOOP;

    v_total := v_subtotal;

    -- ========================================================================
    -- B. PROCESAR CLIENTES Y CUENTA CORRIENTE
    -- ========================================================================
    IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = balance + v_total, updated_at = now()
        WHERE id = p_customer_id;

        INSERT INTO customer_account_movements (customer_id, type, amount, description) 
        VALUES (p_customer_id, 'charge', v_total, 'Compra Fiado');
    END IF;

    -- ========================================================================
    -- C. REGISTRAR VENTA
    -- ========================================================================
    INSERT INTO sales (organization_id, customer_id, subtotal, total, payment_method, payment_status, status) 
    VALUES (p_org_id, p_customer_id, v_subtotal, v_total, p_payment_method, CASE WHEN p_payment_method = 'credit' THEN 'pending' ELSE 'paid' END, 'completed') 
    RETURNING id INTO v_sale_id;

    -- ========================================================================
    -- D. DESCONTAR STOCK (LO MÁS IMPORTANTE)
    -- ========================================================================
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_product_name := v_item->>'product_name';

        -- 1. Guardar detalle
        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total) 
        VALUES (v_sale_id, v_product_id, COALESCE(v_product_name, 'Sin nombre'), v_quantity, v_unit_price, (v_unit_price * v_quantity));

        -- 2. Descontar Inventario
        SELECT is_combo INTO v_is_combo FROM products WHERE id = v_product_id;
        
        IF v_is_combo IS TRUE THEN
            -- ES COMBO: Descontar de los HIJOS (Componentes)
            FOR v_component IN SELECT child_product_id, quantity FROM product_combos WHERE parent_product_id = v_product_id
            LOOP
                UPDATE products 
                SET stock = stock - (v_component.quantity * v_quantity),
                    updated_at = now()
                WHERE id = v_component.child_product_id;
            END LOOP;
            
            -- Opcional: También descontar del stock del combo si el usuario le puso stock manual
            -- UPDATE products SET stock = stock - v_quantity WHERE id = v_product_id;
        ELSE
            -- ES SIMPLE: Descontar directo
            UPDATE products 
            SET stock = stock - v_quantity,
                updated_at = now()
            WHERE id = v_product_id;
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION process_sale TO authenticated;
