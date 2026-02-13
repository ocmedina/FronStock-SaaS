-- Migration: Función para recibir órdenes de compra y actualizar stock
-- Description: Procesa la recepción de órdenes de compra, actualiza inventario y registra movimientos

-- Función para recibir orden de compra completa
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_purchase_order_id UUID,
  p_items JSONB -- Array de {product_id, received_quantity}
)
RETURNS JSONB AS $$
DECLARE
  v_organization_id UUID;
  v_order_status TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_received_qty INT;
  v_product_name TEXT;
  v_unit_cost NUMERIC;
  v_result JSONB;
BEGIN
  -- Verificar que la orden existe y obtener datos
  SELECT organization_id, status 
  INTO v_organization_id, v_order_status
  FROM purchase_orders
  WHERE id = p_purchase_order_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden de compra no encontrada');
  END IF;

  IF v_order_status = 'received' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La orden ya fue recibida anteriormente');
  END IF;

  IF v_order_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede recibir una orden cancelada');
  END IF;

  -- Procesar cada item recibido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_received_qty := (v_item->>'received_quantity')::INT;

    -- Obtener información del item de la orden
    SELECT product_name, unit_cost
    INTO v_product_name, v_unit_cost
    FROM purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id 
      AND product_id = v_product_id;

    IF v_product_name IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Producto ' || v_product_id || ' no encontrado en la orden'
      );
    END IF;

    -- Actualizar cantidad recibida en el item
    UPDATE purchase_order_items
    SET received_quantity = v_received_qty
    WHERE purchase_order_id = p_purchase_order_id 
      AND product_id = v_product_id;

    -- Actualizar stock del producto
    UPDATE products
    SET 
      stock = stock + v_received_qty,
      cost_price = v_unit_cost, -- Actualizar precio de costo con el precio de compra
      updated_at = NOW()
    WHERE id = v_product_id 
      AND organization_id = v_organization_id;

    -- Registrar movimiento de stock
    INSERT INTO stock_movements (
      organization_id,
      product_id,
      product_name,
      quantity,
      movement_type,
      reason,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_organization_id,
      v_product_id,
      v_product_name,
      v_received_qty,
      'in',
      'purchase',
      'purchase_order',
      p_purchase_order_id,
      'Recepción de orden de compra - ' || v_product_name
    );

  END LOOP;

  -- Marcar orden como recibida
  UPDATE purchase_orders
  SET 
    status = 'received',
    received_at = NOW(),
    updated_at = NOW()
  WHERE id = p_purchase_order_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Orden de compra recibida exitosamente',
    'purchase_order_id', p_purchase_order_id,
    'items_processed', jsonb_array_length(p_items)
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para recepción parcial (marcar como 'ordered' pero registrar cantidades)
CREATE OR REPLACE FUNCTION partial_receive_purchase_order(
  p_purchase_order_id UUID,
  p_items JSONB -- Array de {product_id, received_quantity}
)
RETURNS JSONB AS $$
DECLARE
  v_organization_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_received_qty INT;
  v_previous_qty INT;
  v_product_name TEXT;
  v_unit_cost NUMERIC;
  v_all_received BOOLEAN := true;
  v_result JSONB;
BEGIN
  -- Verificar que la orden existe
  SELECT organization_id INTO v_organization_id
  FROM purchase_orders
  WHERE id = p_purchase_order_id;

  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden de compra no encontrada');
  END IF;

  -- Procesar cada item recibido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_received_qty := (v_item->>'received_quantity')::INT;

    -- Obtener información del item
    SELECT product_name, unit_cost, COALESCE(received_quantity, 0)
    INTO v_product_name, v_unit_cost, v_previous_qty
    FROM purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id 
      AND product_id = v_product_id;

    -- Solo procesar si hay cantidad nueva a recibir
    IF v_received_qty > v_previous_qty THEN
      DECLARE
        v_qty_to_add INT := v_received_qty - v_previous_qty;
      BEGIN
        -- Actualizar cantidad recibida acumulada
        UPDATE purchase_order_items
        SET received_quantity = v_received_qty
        WHERE purchase_order_id = p_purchase_order_id 
          AND product_id = v_product_id;

        -- Actualizar stock
        UPDATE products
        SET 
          stock = stock + v_qty_to_add,
          cost_price = v_unit_cost,
          updated_at = NOW()
        WHERE id = v_product_id 
          AND organization_id = v_organization_id;

        -- Registrar movimiento
        INSERT INTO stock_movements (
          organization_id,
          product_id,
          product_name,
          quantity,
          movement_type,
          reason,
          reference_type,
          reference_id,
          notes
        ) VALUES (
          v_organization_id,
          v_product_id,
          v_product_name,
          v_qty_to_add,
          'in',
          'purchase',
          'purchase_order',
          p_purchase_order_id,
          'Recepción parcial - ' || v_product_name
        );
      END;
    END IF;

  END LOOP;

  -- Verificar si todos los items fueron recibidos completamente
  SELECT NOT EXISTS (
    SELECT 1 FROM purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
      AND COALESCE(received_quantity, 0) < quantity
  ) INTO v_all_received;

  -- Actualizar estado de la orden
  IF v_all_received THEN
    UPDATE purchase_orders
    SET 
      status = 'received',
      received_at = NOW(),
      updated_at = NOW()
    WHERE id = p_purchase_order_id;
  ELSE
    UPDATE purchase_orders
    SET 
      status = 'ordered',
      updated_at = NOW()
    WHERE id = p_purchase_order_id
      AND status = 'pending'; -- Solo actualizar si estaba pending
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN v_all_received THEN 'Orden completamente recibida'
      ELSE 'Recepción parcial registrada'
    END,
    'fully_received', v_all_received,
    'purchase_order_id', p_purchase_order_id
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener productos faltantes de recibir
CREATE OR REPLACE FUNCTION get_purchase_order_pending_items(p_purchase_order_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  quantity INT,
  received_quantity INT,
  pending_quantity INT,
  unit_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    poi.product_id,
    poi.product_name,
    poi.quantity,
    COALESCE(poi.received_quantity, 0) as received_quantity,
    poi.quantity - COALESCE(poi.received_quantity, 0) as pending_quantity,
    poi.unit_cost
  FROM purchase_order_items poi
  WHERE poi.purchase_order_id = p_purchase_order_id
    AND COALESCE(poi.received_quantity, 0) < poi.quantity
  ORDER BY poi.product_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at en purchase_orders
CREATE OR REPLACE FUNCTION update_purchase_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trigger_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_updated_at();

-- Trigger similar para purchase_order_items si no existe
DROP TRIGGER IF EXISTS trigger_purchase_order_items_updated_at ON purchase_order_items;

-- Índices adicionales para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

