-- =============================================================================
-- MIGRACIÓN: Descuentos y Recargos en Ventas
-- Fecha: 2026-01-28
-- Descripción:
-- 1. Agrega columnas discount y surcharge a la tabla sales.
-- 2. Actualiza process_sale para verificar totales considerando descuentos.
-- =============================================================================

-- 1. Modificar tabla sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS surcharge numeric DEFAULT 0;

-- 2. Actualizar process_sale para soportar descuentos
DROP FUNCTION IF EXISTS process_sale(uuid, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payments jsonb DEFAULT '[]'::jsonb,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_discount numeric DEFAULT 0,
    p_surcharge numeric DEFAULT 0
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
    v_payment_method text;
    v_payment_amount numeric;
    v_total_paid numeric := 0;
    v_has_credit boolean := false;
    v_main_payment_method text;
    v_payments_count integer;
    v_final_total numeric := 0;
BEGIN
    -- Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
    END IF;

    -- Validar que hay pagos
    IF jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'No hay información de pago';
    END IF;

    -- 1. VALIDACIÓN DE STOCK Y CÁLCULO DE TOTALES
    FOR v_item IN SELECT jsonb_array_elements(p_items)
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
                    RAISE EXCEPTION 'Stock insuficiente para componente de combo (ID: %).', v_component.child_product_id;
                END IF;
            END LOOP;
        ELSE
            -- Producto normal
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', 
                    v_product_id, v_current_stock, v_quantity;
            END IF;
        END IF;
        
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- Aplicar descuentos y recargos
    v_total := v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_surcharge, 0);
    
    -- Asegurar que el total no sea negativo
    IF v_total < 0 THEN 
        v_total := 0;
    END IF;

    -- 2. DETERMINAR ESTADO Y MÉTODO PRINCIPAL
    v_payments_count := jsonb_array_length(p_payments);
    
    -- Calcular total pagado y verificar si hay crédito
    FOR v_payment IN SELECT jsonb_array_elements(p_payments)
    LOOP
        v_payment_method := v_payment->>'method';
        v_payment_amount := (v_payment->>'amount')::numeric;
        
        v_total_paid := v_total_paid + v_payment_amount;
        
        IF v_payment_method = 'credit' THEN
            v_has_credit := true;
        END IF;
    END LOOP;

    -- Validar montos (con margen de error por decimales)
    IF ABS(v_total_paid - v_total) > 0.01 THEN
        RAISE EXCEPTION 'El total de pagos (%) no coincide con el total de la venta (%) (Sub: % - Desc: % + Rec: %)', 
            v_total_paid, v_total, v_subtotal, p_discount, p_surcharge;
    END IF;

    -- Determinar método principal para registro en tabla sales
    IF v_payments_count > 1 THEN
        v_main_payment_method := 'mixed';
    ELSE
        v_main_payment_method := p_payments->0->>'method';
    END IF;

    -- 3. INSERTAR VENTA
    INSERT INTO sales (
        organization_id,
        customer_id,
        subtotal,
        total,
        discount,    -- Nuevo
        surcharge,   -- Nuevo
        payment_method,
        payment_status,
        status
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        COALESCE(p_discount, 0),
        COALESCE(p_surcharge, 0),
        v_main_payment_method,
        CASE WHEN v_has_credit THEN 'pending' ELSE 'paid' END,
        'completed'
    ) RETURNING id INTO v_sale_id;

    -- 4. PROCESAR PAGOS Y CRÉDITOS
    FOR v_payment IN SELECT jsonb_array_elements(p_payments)
    LOOP
        v_payment_method := v_payment->>'method';
        v_payment_amount := (v_payment->>'amount')::numeric;

        -- Registrar en sale_payments
        INSERT INTO sale_payments (
            sale_id,
            organization_id,
            payment_method,
            amount
        ) VALUES (
            v_sale_id,
            p_org_id,
            v_payment_method,
            v_payment_amount
        );

        -- Si es crédito, impactar cuenta corriente
        IF v_payment_method = 'credit' THEN
            IF p_customer_id IS NULL THEN
                RAISE EXCEPTION 'Para pagos a crédito debe seleccionar un cliente';
            END IF;

            -- Actualizar balance
            UPDATE customers 
            SET balance = COALESCE(balance, 0) + v_payment_amount,
                updated_at = now()
            WHERE id = p_customer_id;

            -- Registrar movimiento
            INSERT INTO customer_account_movements (
                customer_id,
                organization_id,
                sale_id,
                type,
                amount,
                description,
                created_at
            ) VALUES (
                p_customer_id,
                p_org_id,
                v_sale_id,
                'charge',
                v_payment_amount,
                'Fiado Parcial - Venta #' || v_sale_id,
                now()
            );
        END IF;
    END LOOP;

    -- 5. INSERTAR ITEMS Y DESCONTAR STOCK
    FOR v_item IN SELECT jsonb_array_elements(p_items)
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

        -- Descontar Stock
        SELECT is_combo INTO v_is_combo FROM products WHERE id = v_product_id;

        IF v_is_combo THEN
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
