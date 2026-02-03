-- =============================================================================
-- MIGRACIÓN: TABLA DE PEDIDOS DEDICADA (2026-02-03)
-- =============================================================================

-- 1. Tabla: ORDERS
-- Separada de 'sales' para evitar mezclar lógica de mostrador con delivery.
CREATE TABLE IF NOT EXISTS orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    customer_id uuid REFERENCES customers(id),
    
    -- Importes
    subtotal numeric DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    discount numeric DEFAULT 0,
    total numeric DEFAULT 0,
    
    -- Estados
    status text DEFAULT 'pending', -- Estado general del registro
    delivery_status text DEFAULT 'pending', -- pending, preparing, ready, out_for_delivery, delivered, cancelled
    payment_status text DEFAULT 'pending', -- pending (fiado/efectivo contra entrega), paid
    payment_method text DEFAULT 'cash', -- cash, transfer, credit
    
    -- Detalles de Entrega
    delivery_address text,
    delivery_notes text,
    estimated_mins integer DEFAULT 30,
    
    -- Metadatos
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Auditoría
    created_by uuid REFERENCES auth.users(id)
);

-- Index para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- 2. Tabla: ORDER_ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    
    -- Snapshot de los datos del producto al momento de la compra
    product_name text,
    quantity integer DEFAULT 1,
    unit_price numeric DEFAULT 0,
    total numeric DEFAULT 0,
    
    created_at timestamptz DEFAULT now()
);

-- 3. Función: CREATE_ORDER
-- Maneja la creación atómica del pedido y el descuento de stock
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
    p_payment_amount numeric DEFAULT NULL -- Para calcular vuelto/pago parcial si fuera necesario
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id uuid;
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
    -- Validar Items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
    END IF;

    -- Validar Stock y Calcular Subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        
        -- Lock row for update
        SELECT stock, name INTO v_current_stock, v_product_name
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;
        
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
        END IF;
        
        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para % (Dispo: %, Solicitado: %)', 
                v_product_name, v_current_stock, v_quantity;
        END IF;
        
        v_item_total := v_unit_price * v_quantity;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- Calcular Total Final
    v_total := v_subtotal + p_delivery_fee - p_discount;

    -- Insertar Order
    INSERT INTO orders (
        organization_id,
        customer_id,
        subtotal,
        delivery_fee,
        discount,
        total,
        payment_method,
        payment_status, -- Por defecto 'pending' para delivery hasta que se pague, o 'paid' si fuera online (aquí asumimos lógica manual)
        delivery_status, -- Por defecto 'pending'
        delivery_address,
        delivery_notes,
        estimated_mins,
        created_by
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        p_delivery_fee,
        p_discount,
        v_total,
        p_payment_method,
        CASE WHEN p_payment_method = 'credit' THEN 'pending' ELSE 'pending' END, -- Ajustar lógica según negocio. Generalmente delivery es 'pending' hasta entrega.
        'pending',
        COALESCE(p_delivery_address, (SELECT address FROM customers WHERE id = p_customer_id LIMIT 1)),
        p_delivery_notes,
        p_estimated_mins,
        auth.uid()
    ) RETURNING id INTO v_order_id;

    -- Insertar Items y Descontar Stock
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

        -- Update Stock
        UPDATE products 
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
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
