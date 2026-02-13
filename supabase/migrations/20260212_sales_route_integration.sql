-- =============================================================================
-- MIGRACIÓN: INTEGRACIÓN DE VENTAS CON RUTAS (2026-02-12)
-- =============================================================================
-- Extiende sales para vincular con rutas y agrega funciones para ventas en reparto

-- 1. Extender tabla sales con campos de ruta
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id), -- Ruta a la que pertenece
ADD COLUMN IF NOT EXISTS route_stop_id uuid REFERENCES route_stops(id), -- Parada específica
ADD COLUMN IF NOT EXISTS signature_url text, -- URL de firma digital en storage
ADD COLUMN IF NOT EXISTS signature_data text, -- Datos de la firma en base64 (alternativa)
ADD COLUMN IF NOT EXISTS remito_number text, -- Número de remito
ADD COLUMN IF NOT EXISTS visit_notes text, -- Notas de la visita
ADD COLUMN IF NOT EXISTS latitude double precision, -- Ubicación GPS al momento de venta
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS gps_accuracy numeric; -- Precisión del GPS en metros

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_route ON sales(route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_route_stop ON sales(route_stop_id) WHERE route_stop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_remito ON sales(remito_number) WHERE remito_number IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN sales.route_id IS 'Ruta a la que pertenece esta venta';
COMMENT ON COLUMN sales.signature_url IS 'URL de la firma digital del cliente (Supabase Storage)';
COMMENT ON COLUMN sales.remito_number IS 'Número de remito asociado';
COMMENT ON COLUMN sales.visit_notes IS 'Notas del repartidor sobre la visita';

-- 2. Función: Procesar venta en ruta
CREATE OR REPLACE FUNCTION process_route_sale(
    p_org_id uuid,
    p_customer_id uuid,
    p_items jsonb,
    p_route_id uuid DEFAULT NULL,
    p_route_stop_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_payment_status text DEFAULT 'paid', -- 'paid' (efectivo/contado) o 'pending' (fiado/cuenta corriente)
    p_discount numeric DEFAULT 0,
    p_signature_url text DEFAULT NULL,
    p_visit_notes text DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_longitude double precision DEFAULT NULL
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
    v_customer_limit numeric;
    v_available_credit numeric;
BEGIN
    -- 1. Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La venta debe contener al menos un producto'
        );
    END IF;

    -- 2. Si es venta fiada, verificar límite de crédito
    IF p_payment_status = 'pending' THEN
        SELECT balance, credit_limit
        INTO v_customer_balance, v_customer_limit
        FROM customers 
        WHERE id = p_customer_id;
        
        -- Calcular total previo
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_unit_price := (v_item->>'unit_price')::numeric;
            v_quantity := (v_item->>'quantity')::integer;
            v_subtotal := v_subtotal + (v_unit_price * v_quantity);
        END LOOP;
        
        v_total := v_subtotal - p_discount;
        
        -- Crédito disponible = límite + balance (balance es negativo si debe)
        v_available_credit := v_customer_limit + v_customer_balance;
        
        IF v_total > v_available_credit THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Cliente excede límite de crédito. Disponible: $%s, Intenta: $%s', 
                    v_available_credit, v_total)
            );
        END IF;
    END IF;

    -- 3. Validar stock y calcular totales
    v_subtotal := 0; -- Reset
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        
        -- Validar stock con lock
        SELECT stock, name INTO v_current_stock, v_product_name
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;
        
        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Producto no encontrado: ' || v_product_id
            );
        END IF;
        
        IF v_current_stock < v_quantity THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Stock insuficiente para %s. Disponible: %s, Solicitado: %s', 
                    v_product_name, v_current_stock, v_quantity)
            );
        END IF;
        
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    v_total := v_subtotal - p_discount;

    -- 4. Crear la venta
    INSERT INTO sales (
        organization_id,
        customer_id,
        subtotal,
        total,
        payment_method,
        payment_status,
        status,
        delivery_status,
        route_id,
        route_stop_id,
        signature_url,
        visit_notes,
        latitude,
        longitude
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        p_payment_method,
        p_payment_status,
        'completed', -- Ya está completada
        'delivered', -- Ya está entregada (es venta en el momento)
        p_route_id,
        p_route_stop_id,
        p_signature_url,
        p_visit_notes,
        p_latitude,
        p_longitude
    ) RETURNING id INTO v_sale_id;

    -- 5. Actualizar saldo del cliente si es fiado
    IF p_payment_status = 'pending' AND p_customer_id IS NOT NULL THEN
        UPDATE customers 
        SET balance = balance - v_total -- Resta del balance (aumenta la deuda)
        WHERE id = p_customer_id;
    END IF;

    -- 6. Insertar items y actualizar stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_product_name := v_item->>'product_name';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_total := v_unit_price * v_quantity;

        -- Insertar sale_item
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

    -- 7. Actualizar route_stop si existe
    IF p_route_stop_id IS NOT NULL THEN
        UPDATE route_stops
        SET 
            visit_status = 'visited',
            visited_at = now(),
            sale_id = v_sale_id
        WHERE id = p_route_stop_id;
    END IF;

    -- 8. Actualizar shift del repartidor si está activo
    IF p_payment_method = 'cash' AND p_payment_status = 'paid' THEN
        -- Solo actualizar collected_cash si pagó en efectivo
        UPDATE delivery_shifts
        SET collected_cash = collected_cash + v_total
        WHERE driver_id = auth.uid()
          AND status = 'active';
    END IF;

    -- 9. Retornar éxito
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'total', v_total,
        'customer_new_balance', (SELECT balance FROM customers WHERE id = p_customer_id)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION process_route_sale IS 'Procesa una venta durante una ruta de reparto con validación de crédito y stock';

-- 3. Función: Registrar visita sin venta
CREATE OR REPLACE FUNCTION register_visit_no_sale(
    p_route_stop_id uuid,
    p_visit_status text, -- 'not_home', 'closed', 'skipped'
    p_visit_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE route_stops
    SET 
        visit_status = p_visit_status,
        visited_at = now(),
        visit_notes = p_visit_notes
    WHERE id = p_route_stop_id;
    
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION register_visit_no_sale IS 'Registra una visita cuando no hay venta (cliente no estaba, cerrado, etc)';

-- 4. Vista: Ventas de ruta con detalles
CREATE OR REPLACE VIEW route_sales_detail AS
SELECT 
    s.id as sale_id,
    s.created_at as sale_date,
    s.total,
    s.payment_method,
    s.payment_status,
    r.id as route_id,
    r.name as route_name,
    rs.stop_order,
    c.name as customer_name,
    c.business_type,
    c.address,
    p.full_name as driver_name,
    s.signature_url,
    s.visit_notes,
    s.organization_id
FROM sales s
LEFT JOIN routes r ON s.route_id = r.id
LEFT JOIN route_stops rs ON s.route_stop_id = rs.id
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN profiles p ON r.driver_id = p.id
WHERE s.route_id IS NOT NULL;

COMMENT ON VIEW route_sales_detail IS 'Detalle de ventas realizadas en rutas';

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION process_route_sale TO authenticated;
GRANT EXECUTE ON FUNCTION register_visit_no_sale TO authenticated;
