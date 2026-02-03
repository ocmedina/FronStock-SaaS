-- =============================================================================
-- MEJORAS DE SEGURIDAD Y RENDIMIENTO (2026-02-03)
-- =============================================================================

-- 1. ACTUALIZAR POLÍTICAS RLS PARA VALIDAR ORGANIZACIÓN
-- Primero eliminamos las políticas básicas
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON orders;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON order_items;

-- Políticas seguras para ORDERS
CREATE POLICY "Users can view orders from their organizations" ON orders
    FOR SELECT
    TO authenticated
    USING (
        organization_id = (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create orders in their organizations" ON orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id = (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update orders in their organizations" ON orders
    FOR UPDATE
    TO authenticated
    USING (
        organization_id = (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Políticas para ORDER_ITEMS (validar a través de la orden)
CREATE POLICY "Users can view order items from their organizations" ON order_items
    FOR SELECT
    TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE organization_id = (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert order items in their organizations" ON order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        order_id IN (
            SELECT id FROM orders 
            WHERE organization_id = (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- 2. ACTUALIZAR FUNCIÓN CREATE_ORDER CON VALIDACIONES
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
    p_payment_amount numeric DEFAULT NULL
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
    -- VALIDACIÓN: Usuario pertenece a la organización
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid()
        AND organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para crear pedidos en esta organización';
    END IF;

    -- Validar Items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto';
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
        AND organization_id = p_org_id  -- Validar que el producto pertenece a la org
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
        payment_status,
        delivery_status,
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
        CASE WHEN p_payment_method = 'credit' THEN 'pending' ELSE 'pending' END,
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

-- 3. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status_active ON orders(delivery_status) 
    WHERE delivery_status != 'delivered';
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 4. AGREGAR CAMPO ASSIGNED_TO PARA REPARTIDORES
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(assigned_to) WHERE assigned_to IS NOT NULL;

-- 5. TABLA DE HISTORIAL DE CAMBIOS DE ESTADO
CREATE TABLE IF NOT EXISTS order_status_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    old_status text,
    new_status text,
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now(),
    notes text
);

CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id, changed_at DESC);

-- Habilitar RLS en historial
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history from their org orders" ON order_status_history
    FOR SELECT
    TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE organization_id = (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- 6. TRIGGER PARA REGISTRAR CAMBIOS DE ESTADO AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.delivery_status, NEW.delivery_status, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;
CREATE TRIGGER order_status_change_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();
