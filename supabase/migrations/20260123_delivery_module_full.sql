-- =============================================================================
-- MIGRACIÓN CONSOLIDADA: MÓDULO DE DELIVERY (2026-01-23)
-- =============================================================================

-- 1. Actualizar tabla CUSTOMERS con campos de dirección y reparto
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Local',
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision,
ADD COLUMN IF NOT EXISTS visit_day integer, -- 0=Domingo, 1=Lunes, etc.
ADD COLUMN IF NOT EXISTS route_order integer;

-- 2. Actualizar tabla SALES con campos de estado de entrega y asignación
-- Definir tipos si no existen (Postgres no tiene 'CREATE TYPE IF NOT EXISTS' nativo clean, so we simulate or just use text check constraints)
-- Usaremos CHECK constraints para simplicidad y compatibilidad

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'returned')) DEFAULT 'delivered',
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS delivery_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_notes text;

-- Asegurar indices
CREATE INDEX IF NOT EXISTS idx_customers_visit_day ON customers(visit_day);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_status ON sales(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sales_assigned_to ON sales(assigned_to);

-- 3. Actualizar RPC process_sale para manejar estos nuevos campos
-- Versión mejorada que soporta 'fiado' (debt) y delivery

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_items jsonb DEFAULT '[]'::jsonb,
    p_delivery_status text DEFAULT 'delivered', -- 'pending' para delivery
    p_payment_status text DEFAULT 'paid', -- 'pending' para fiado
    p_assigned_to uuid DEFAULT NULL,
    p_delivery_address text DEFAULT NULL,
    p_delivery_notes text DEFAULT NULL,
    p_discount numeric DEFAULT 0
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
        
        -- Solo validar stock si se va a entregar ahora o reservar. 
        -- Asumimos que delivery reserva stock inmediatamente.
        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, Solicitado: %', 
                v_product_id, v_current_stock, v_quantity;
        END IF;
        
        -- Acumular totales
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
        status, -- 'completed' para ventas normales, 'pending' si es preventa (pero usaremos completed para confirmar el pedido)
        delivery_status,
        assigned_to,
        delivery_address,
        delivery_date -- fecha progranada o actual
    ) VALUES (
        p_org_id,
        p_customer_id,
        v_subtotal,
        v_total,
        p_payment_method,
        p_payment_status,
        'completed', -- Siempre completed como "Pedido Confirmado"
        p_delivery_status,
        p_assigned_to,
        COALESCE(p_delivery_address, (SELECT address FROM customers WHERE id = p_customer_id LIMIT 1)),
        now() -- Por defecto ahora, se podría pasar como param si es programada
    ) RETURNING id INTO v_sale_id;

    -- Actualizar saldo del cliente si es fiado
    IF p_payment_status = 'pending' AND p_customer_id IS NOT NULL THEN
        -- Asumimos que existe una columna 'balance' en customers o se calcula.
        -- Si existe, la actualizamos:
        UPDATE customers 
        SET balance = COALESCE(balance, 0) - v_total -- Resta saldo (deuda aumenta o saldo disminuye según lógica)
        -- Ajustar lógica según preferencia: Deuda + o Saldo - ?
        -- Usualmente: Balance Positivo = Favor cliente, Negativo = Deuda. 
        -- Si compra fiado, balance disminuye.
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

        -- Actualizar stock (se descuenta al confirmar pedido)
        UPDATE products 
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    -- Retornar información de la venta
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

-- 4. Nueva RPC para actualizar estatus de delivery rápidamente
CREATE OR REPLACE FUNCTION update_delivery_status(
    p_sale_id uuid,
    p_status text,
    p_assigned_to uuid DEFAULT NULL
) 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sales
    SET 
        delivery_status = p_status,
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        updated_at = now()
    WHERE id = p_sale_id;
    
    RETURN FOUND;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_sale TO authenticated;
GRANT EXECUTE ON FUNCTION update_delivery_status TO authenticated;
