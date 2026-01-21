-- =============================================================================
-- MIGRACIÓN: Sistema de Cuentas Corrientes + Tipo de Cliente
-- Agrega campo balance y customer_type a clientes, y tabla de movimientos
-- =============================================================================
-- 
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en Supabase Dashboard
-- 2. Ve a SQL Editor
-- 3. Pega y ejecuta este script
-- =============================================================================

-- Agregar campo balance a clientes (deuda pendiente)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;

-- Agregar campo customer_type (retail=minorista, wholesale=mayorista)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale'));

-- Crear tabla de movimientos de cuenta corriente
CREATE TABLE IF NOT EXISTS customer_account_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('charge', 'payment')),
    amount numeric NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cam_customer ON customer_account_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_cam_org ON customer_account_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_cam_created ON customer_account_movements(created_at DESC);

-- Habilitar RLS
ALTER TABLE customer_account_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ver movimientos
CREATE POLICY "Users can view their org movements" ON customer_account_movements
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Políticas RLS para insertar movimientos
CREATE POLICY "Users can insert their org movements" ON customer_account_movements
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- =============================================================================
-- ACTUALIZAR FUNCIÓN process_sale PARA SOPORTAR CRÉDITO/FIADO
-- =============================================================================

-- Primero eliminar la versión anterior (con 4 argumentos)
DROP FUNCTION IF EXISTS process_sale(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION process_sale(
    p_org_id uuid,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT 'cash',
    p_items jsonb DEFAULT '[]'::jsonb,
    p_is_credit boolean DEFAULT false
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
    v_payment_status text;
BEGIN
    -- Validar que hay items
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No hay productos en la venta';
    END IF;

    -- Si es crédito, requiere cliente
    IF p_is_credit AND p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Para ventas a crédito debe seleccionar un cliente';
    END IF;

    -- Determinar estado de pago
    IF p_is_credit THEN
        v_payment_status := 'pending';
    ELSE
        v_payment_status := 'paid';
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
        CASE WHEN p_is_credit THEN 'credit' ELSE p_payment_method END,
        v_payment_status,
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

    -- Si es crédito, actualizar balance del cliente y registrar movimiento
    IF p_is_credit THEN
        -- Incrementar balance (deuda) del cliente
        UPDATE customers 
        SET balance = COALESCE(balance, 0) + v_total
        WHERE id = p_customer_id;

        -- Registrar movimiento de cargo
        INSERT INTO customer_account_movements (
            customer_id,
            organization_id,
            sale_id,
            type,
            amount,
            description
        ) VALUES (
            p_customer_id,
            p_org_id,
            v_sale_id,
            'charge',
            v_total,
            'Venta a crédito #' || v_sale_id::text
        );
    END IF;

    -- Retornar información de la venta
    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'total', v_total,
        'items_count', jsonb_array_length(p_items),
        'is_credit', p_is_credit
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

-- =============================================================================
-- FUNCIÓN PARA REGISTRAR PAGOS DE CLIENTES
-- =============================================================================

CREATE OR REPLACE FUNCTION register_customer_payment(
    p_org_id uuid,
    p_customer_id uuid,
    p_amount numeric,
    p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance numeric;
    v_new_balance numeric;
BEGIN
    -- Validar monto positivo
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;

    -- Obtener balance actual
    SELECT COALESCE(balance, 0) INTO v_current_balance
    FROM customers
    WHERE id = p_customer_id AND organization_id = p_org_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Cliente no encontrado';
    END IF;

    -- Calcular nuevo balance
    v_new_balance := v_current_balance - p_amount;
    IF v_new_balance < 0 THEN
        v_new_balance := 0;
    END IF;

    -- Actualizar balance
    UPDATE customers 
    SET balance = v_new_balance
    WHERE id = p_customer_id;

    -- Registrar movimiento de pago
    INSERT INTO customer_account_movements (
        customer_id,
        organization_id,
        type,
        amount,
        description
    ) VALUES (
        p_customer_id,
        p_org_id,
        'payment',
        p_amount,
        COALESCE(p_description, 'Pago de cliente')
    );

    RETURN jsonb_build_object(
        'success', true,
        'previous_balance', v_current_balance,
        'payment_amount', p_amount,
        'new_balance', v_new_balance
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Dar permisos para ejecutar las funciones
GRANT EXECUTE ON FUNCTION process_sale TO authenticated;
GRANT EXECUTE ON FUNCTION register_customer_payment TO authenticated;

-- =============================================================================
-- ¡LISTO! Ejecuta este script en Supabase SQL Editor
-- =============================================================================
