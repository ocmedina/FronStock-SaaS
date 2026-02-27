-- =============================================================================
-- FASE 1 B2B PREVENTA + REPARTO (ADITIVA, SIN RUPTURAS)
-- =============================================================================

-- 1) Extender ORDERS para flujo unificado preventa->entrega
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'delivery', -- delivery | preorder
ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'confirmed', -- draft|confirmed|assigned|in_delivery|delivered|not_delivered|rescheduled|cancelled
ADD COLUMN IF NOT EXISTS assigned_route_id uuid REFERENCES routes(id),
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_org_lifecycle
  ON orders(organization_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_orders_org_route
  ON orders(organization_id, assigned_route_id)
  WHERE assigned_route_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_org_type
  ON orders(organization_id, order_type);

-- 2) Extender ROUTE_STOPS para referenciar pedidos (además de sale_id)
ALTER TABLE route_stops
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_route_order_unique
  ON route_stops(route_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_stops_order
  ON route_stops(order_id)
  WHERE order_id IS NOT NULL;

-- 3) Tabla de pagos por pedido (soporta pago parcial/múltiple)
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method text NOT NULL, -- cash | transfer | card | credit
  amount numeric NOT NULL CHECK (amount > 0),
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_org_order
  ON order_payments(organization_id, order_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_payments_org_date
  ON order_payments(organization_id, paid_at DESC);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order payments from their organization" ON order_payments;
CREATE POLICY "Users can view order payments from their organization"
  ON order_payments FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create order payments in their organization" ON order_payments;
CREATE POLICY "Users can create order payments in their organization"
  ON order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 4) Tabla de eventos por pedido (timeline/auditoría)
CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- status_changed|payment_registered|incident|assigned|unassigned|note
  from_status text,
  to_status text,
  payload jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_org_order
  ON order_events(organization_id, order_id, created_at DESC);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order events from their organization" ON order_events;
CREATE POLICY "Users can view order events from their organization"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create order events in their organization" ON order_events;
CREATE POLICY "Users can create order events in their organization"
  ON order_events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5) RPC: Crear preventa (wrapper sobre create_order)
CREATE OR REPLACE FUNCTION create_preorder(
  p_org_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT NULL,
  p_client_reference text DEFAULT NULL
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
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND organization_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para crear preventa en esta organización');
  END IF;

  IF p_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'La preventa requiere cliente');
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La preventa debe contener al menos un producto');
  END IF;

  IF p_client_reference IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM orders
    WHERE organization_id = p_org_id
      AND client_reference = p_client_reference
    LIMIT 1;

    IF v_order_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'preorder', true, 'idempotent_replay', true);
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;

    SELECT stock, name INTO v_current_stock, v_product_name
    FROM products
    WHERE id = v_product_id
      AND organization_id = p_org_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado o fuera de organización');
    END IF;

    IF v_current_stock < v_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', format('Stock insuficiente para %s', v_product_name));
    END IF;

    v_item_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  v_total := v_subtotal;

  INSERT INTO orders (
    organization_id,
    customer_id,
    subtotal,
    delivery_fee,
    discount,
    total,
    status,
    delivery_status,
    payment_status,
    payment_method,
    delivery_notes,
    estimated_mins,
    client_reference,
    order_type,
    lifecycle_status,
    scheduled_for,
    created_by
  ) VALUES (
    p_org_id,
    p_customer_id,
    v_subtotal,
    0,
    0,
    v_total,
    'confirmed',
    'pending',
    'pending',
    'credit',
    p_notes,
    30,
    p_client_reference,
    'preorder',
    'confirmed',
    p_scheduled_for,
    auth.uid()
  ) RETURNING id INTO v_order_id;

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

    UPDATE products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  INSERT INTO order_events (
    organization_id,
    order_id,
    event_type,
    to_status,
    notes,
    payload,
    created_by
  ) VALUES (
    p_org_id,
    v_order_id,
    'status_changed',
    'confirmed',
    p_notes,
    jsonb_build_object('order_type', 'preorder'),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'preorder', true,
    'idempotent_replay', false
  );
EXCEPTION
  WHEN unique_violation THEN
    IF p_client_reference IS NOT NULL THEN
      SELECT id INTO v_order_id
      FROM orders
      WHERE organization_id = p_org_id
        AND client_reference = p_client_reference
      LIMIT 1;

      IF v_order_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'preorder', true, 'idempotent_replay', true);
      END IF;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 6) RPC: Asignar pedidos a una ruta
CREATE OR REPLACE FUNCTION assign_orders_to_route(
  p_org_id uuid,
  p_route_id uuid,
  p_order_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route routes%ROWTYPE;
  v_order_id uuid;
  v_order_record orders%ROWTYPE;
  v_stop_order integer;
  v_assigned_count integer := 0;
BEGIN
  SELECT * INTO v_route
  FROM routes
  WHERE id = p_route_id
    AND organization_id = p_org_id
  LIMIT 1;

  IF v_route.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
  END IF;

  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se enviaron pedidos para asignar');
  END IF;

  FOR v_order_id IN SELECT unnest(p_order_ids)
  LOOP
    SELECT * INTO v_order_record
    FROM orders
    WHERE id = v_order_id
      AND organization_id = p_org_id
    LIMIT 1;

    IF v_order_record.id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_order_record.customer_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE orders
    SET
      assigned_route_id = p_route_id,
      assigned_to = COALESCE(v_route.driver_id, assigned_to),
      lifecycle_status = 'assigned',
      status = 'assigned',
      updated_at = now()
    WHERE id = v_order_record.id;

    IF NOT EXISTS (
      SELECT 1
      FROM route_stops
      WHERE route_id = p_route_id
        AND order_id = v_order_record.id
    ) THEN
      SELECT COALESCE(MAX(stop_order), 0) + 1
      INTO v_stop_order
      FROM route_stops
      WHERE route_id = p_route_id;

      INSERT INTO route_stops (
        route_id,
        customer_id,
        stop_order,
        visit_status,
        address_snapshot,
        order_id
      ) VALUES (
        p_route_id,
        v_order_record.customer_id,
        v_stop_order,
        'pending',
        COALESCE(v_order_record.delivery_address, (SELECT address FROM customers WHERE id = v_order_record.customer_id LIMIT 1)),
        v_order_record.id
      );
    END IF;

    INSERT INTO order_events (
      organization_id,
      order_id,
      event_type,
      from_status,
      to_status,
      payload,
      created_by
    ) VALUES (
      p_org_id,
      v_order_record.id,
      'assigned',
      v_order_record.lifecycle_status,
      'assigned',
      jsonb_build_object('route_id', p_route_id),
      auth.uid()
    );

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  UPDATE routes
  SET total_stops = (
    SELECT COUNT(*)
    FROM route_stops
    WHERE route_id = p_route_id
  )
  WHERE id = p_route_id;

  RETURN jsonb_build_object(
    'success', true,
    'assigned_count', v_assigned_count,
    'route_id', p_route_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7) RPC: Cambiar estado unificado de pedido
CREATE OR REPLACE FUNCTION set_order_status(
  p_org_id uuid,
  p_order_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_delivery_status text;
BEGIN
  IF p_new_status NOT IN ('draft', 'confirmed', 'assigned', 'in_delivery', 'delivered', 'not_delivered', 'rescheduled', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado inválido');
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND organization_id = p_org_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  v_delivery_status := CASE p_new_status
    WHEN 'in_delivery' THEN 'out_for_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'not_delivered' THEN 'cancelled'
    ELSE COALESCE(v_order.delivery_status, 'pending')
  END;

  UPDATE orders
  SET
    lifecycle_status = p_new_status,
    status = p_new_status,
    delivery_status = v_delivery_status,
    delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_events (
    organization_id,
    order_id,
    event_type,
    from_status,
    to_status,
    notes,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    'status_changed',
    v_order.lifecycle_status,
    p_new_status,
    p_notes,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 8) RPC: Registrar pago de pedido
CREATE OR REPLACE FUNCTION register_order_payment(
  p_org_id uuid,
  p_order_id uuid,
  p_method text,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_paid_total numeric;
  v_new_payment_status text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monto inválido');
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND organization_id = p_org_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  INSERT INTO order_payments (
    organization_id,
    order_id,
    method,
    amount,
    reference,
    notes,
    paid_by
  ) VALUES (
    p_org_id,
    p_order_id,
    p_method,
    p_amount,
    p_reference,
    p_notes,
    auth.uid()
  );

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid_total
  FROM order_payments
  WHERE organization_id = p_org_id
    AND order_id = p_order_id;

  v_new_payment_status := CASE
    WHEN v_paid_total >= COALESCE(v_order.total, 0) THEN 'paid'
    WHEN v_paid_total > 0 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE orders
  SET
    payment_status = v_new_payment_status,
    payment_method = COALESCE(payment_method, p_method),
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_events (
    organization_id,
    order_id,
    event_type,
    payload,
    notes,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    'payment_registered',
    jsonb_build_object('method', p_method, 'amount', p_amount, 'paid_total', v_paid_total),
    p_notes,
    auth.uid()
  );

  IF p_method = 'cash' THEN
    UPDATE delivery_shifts
    SET collected_cash = collected_cash + p_amount
    WHERE driver_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'paid_total', v_paid_total,
    'payment_status', v_new_payment_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 9) RPC: Marcar incidencia de pedido
CREATE OR REPLACE FUNCTION mark_order_incident(
  p_org_id uuid,
  p_order_id uuid,
  p_incident text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_status text;
BEGIN
  v_target_status := CASE
    WHEN p_incident IN ('not_home', 'address_issue', 'customer_rejected') THEN 'not_delivered'
    WHEN p_incident IN ('rescheduled', 'retry') THEN 'rescheduled'
    ELSE 'not_delivered'
  END;

  UPDATE orders
  SET
    lifecycle_status = v_target_status,
    status = v_target_status,
    delivery_status = CASE WHEN v_target_status = 'rescheduled' THEN 'pending' ELSE 'cancelled' END,
    delivery_notes = CONCAT_WS(E'\n', delivery_notes, COALESCE(p_notes, p_incident)),
    updated_at = now()
  WHERE id = p_order_id
    AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  INSERT INTO order_events (
    organization_id,
    order_id,
    event_type,
    to_status,
    notes,
    payload,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    'incident',
    v_target_status,
    p_notes,
    jsonb_build_object('incident', p_incident),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', v_target_status);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 10) Permisos de ejecución
GRANT EXECUTE ON FUNCTION create_preorder(uuid, uuid, jsonb, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_orders_to_route(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION set_order_status(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION register_order_payment(uuid, uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_order_incident(uuid, uuid, text, text) TO authenticated;
