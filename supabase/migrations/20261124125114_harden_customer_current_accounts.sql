-- Keep customer balances, payment history, and organization access checks in one transaction.

CREATE OR REPLACE FUNCTION public.actor_has_org_permission(
  p_org_id uuid,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_profile_org_id uuid;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_module IS NULL OR p_action IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.organization_id, p.role
    INTO v_profile_org_id, v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT FOUND OR v_profile_org_id IS DISTINCT FROM p_org_id THEN
    RETURN false;
  END IF;

  SELECT CASE p_action
      WHEN 'view' THEN op.can_view
      WHEN 'create' THEN op.can_create
      WHEN 'edit' THEN op.can_edit
      WHEN 'delete' THEN op.can_delete
      ELSE false
    END
    INTO v_allowed
  FROM public.organization_permissions op
  WHERE op.organization_id = p_org_id
    AND op.role = v_role
    AND op.module = p_module
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_allowed, false);
  END IF;

  RETURN CASE
    WHEN p_module = 'customers' AND p_action = 'edit'
      THEN v_role IN ('owner', 'admin', 'manager')
    WHEN p_module = 'sales' AND p_action = 'create'
      THEN v_role IN ('owner', 'admin', 'manager', 'employee')
    WHEN p_module = 'orders' AND p_action = 'create'
      THEN v_role IN ('owner', 'admin', 'manager', 'employee')
    WHEN p_module = 'orders' AND p_action = 'edit'
      THEN v_role IN ('owner', 'admin', 'manager', 'delivery')
    WHEN p_module = 'sales' AND p_action = 'edit'
      THEN v_role IN ('owner', 'admin', 'manager', 'delivery')
    WHEN p_module = 'delivery' AND p_action = 'edit'
      THEN v_role IN ('owner', 'admin', 'manager', 'delivery')
    ELSE false
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.actor_has_org_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_order_status(
  p_org_id uuid,
  p_order_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_delivery_status text;
BEGIN
  IF NOT (
    public.actor_has_org_permission(p_org_id, 'orders', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'delivery', 'edit')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado para actualizar pedidos');
  END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN (
    'draft', 'confirmed', 'assigned', 'in_delivery', 'delivered',
    'not_delivered', 'rescheduled', 'cancelled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado inválido');
  END IF;
  IF p_new_status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Confirmá la entrega y el cobro desde la pantalla de reparto'
    );
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  v_delivery_status := CASE p_new_status
    WHEN 'in_delivery' THEN 'out_for_delivery'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'not_delivered' THEN 'cancelled'
    ELSE COALESCE(v_order.delivery_status, 'pending')
  END;

  UPDATE public.orders
  SET lifecycle_status = p_new_status,
      status = p_new_status,
      delivery_status = v_delivery_status,
      updated_at = now()
  WHERE id = p_order_id AND organization_id = p_org_id;

  INSERT INTO public.order_events (
    organization_id, order_id, event_type, from_status, to_status, notes, created_by
  ) VALUES (
    p_org_id, p_order_id, 'status_changed', v_order.lifecycle_status, p_new_status, p_notes, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_status(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid, uuid, text, text) TO authenticated;

-- Hide the old SECURITY DEFINER implementations behind checked entry points.
ALTER FUNCTION public.process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text)
  RENAME TO process_sale_unchecked;
ALTER FUNCTION public.process_sale(uuid, uuid, text, jsonb, text, text, uuid, text, text, numeric, text)
  RENAME TO process_sale_legacy_unchecked;

REVOKE ALL ON FUNCTION public.process_sale_unchecked(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_sale_legacy_unchecked(uuid, uuid, text, jsonb, text, text, uuid, text, text, numeric, text)
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.process_sale_unchecked(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.process_sale_legacy_unchecked(uuid, uuid, text, jsonb, text, text, uuid, text, text, numeric, text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric)
  RENAME TO create_order_legacy_unchecked;
ALTER FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text)
  RENAME TO create_order_unchecked;
REVOKE ALL ON FUNCTION public.create_order_legacy_unchecked(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_order_unchecked(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text)
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.create_order_legacy_unchecked(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.create_order_unchecked(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text)
  SET search_path = pg_catalog, public;

CREATE FUNCTION public.process_sale(
  p_org_id uuid,
  p_customer_id uuid,
  p_payments jsonb,
  p_items jsonb,
  p_discount numeric DEFAULT 0,
  p_surcharge numeric DEFAULT 0,
  p_supplier_payment jsonb DEFAULT NULL,
  p_client_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_payment jsonb;
  v_method text;
  v_amount numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_payment_total numeric := 0;
  v_credit_amount numeric := 0;
  v_balance numeric;
  v_credit_limit numeric;
  v_existing_sale_id uuid;
  v_existing_total numeric;
  v_result jsonb;
BEGIN
  IF NOT public.actor_has_org_permission(p_org_id, 'sales', 'create') THEN
    RAISE EXCEPTION 'No autorizado para registrar ventas' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(trim(COALESCE(p_client_reference, '')), '') IS NOT NULL THEN
    SELECT s.id, s.total INTO v_existing_sale_id, v_existing_total
    FROM public.sales s
    WHERE s.organization_id = p_org_id
      AND s.client_reference = trim(p_client_reference)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_existing_sale_id,
        'total', v_existing_total,
        'already_exists', true
      );
    END IF;
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos';
  END IF;
  IF jsonb_typeof(p_payments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene pagos';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS items(value)
  LOOP
    v_subtotal := v_subtotal + COALESCE(
      NULLIF(v_item->>'subtotal', '')::numeric,
      NULLIF(v_item->>'total', '')::numeric,
      (v_item->>'quantity')::numeric * COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, NULLIF(v_item->>'price', '')::numeric)
    );

    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = (v_item->>'product_id')::uuid
        AND p.organization_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Producto no encontrado en esta organización';
    END IF;
  END LOOP;

  v_total := v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_surcharge, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'El total de la venta no puede ser negativo';
  END IF;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) AS payments(value)
  LOOP
    v_method := lower(trim(COALESCE(v_payment->>'method', '')));
    v_amount := NULLIF(v_payment->>'amount', '')::numeric;
    IF v_method = '' OR v_amount IS NULL OR v_amount <= 0
       OR v_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Cada pago debe tener un método y un monto mayor a cero';
    END IF;
    v_payment_total := v_payment_total + v_amount;
    IF v_method IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
      v_credit_amount := v_credit_amount + v_amount;
    END IF;
  END LOOP;

  IF abs(v_payment_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Los pagos no coinciden con el total de la venta';
  END IF;
  IF v_credit_amount > v_total THEN
    RAISE EXCEPTION 'El monto fiado supera el total de la venta';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT COALESCE(c.balance, 0), COALESCE(c.credit_limit, 0)
      INTO v_balance, v_credit_limit
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente no encontrado en esta organización';
    END IF;
  ELSIF v_credit_amount > 0 THEN
    RAISE EXCEPTION 'Se requiere un cliente para registrar una venta fiada';
  END IF;

  IF v_credit_amount > 0 AND v_credit_limit > 0 AND v_balance + v_credit_amount > v_credit_limit THEN
    RAISE EXCEPTION 'La venta supera el límite de crédito disponible';
  END IF;

  IF p_supplier_payment IS NOT NULL
     AND COALESCE(NULLIF(p_supplier_payment->>'amount', '')::numeric, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.suppliers s
       WHERE s.id = (p_supplier_payment->>'supplier_id')::uuid
         AND s.organization_id = p_org_id
     ) THEN
    RAISE EXCEPTION 'Proveedor no encontrado en esta organización';
  END IF;

  v_result := public.process_sale_unchecked(
    p_org_id, p_customer_id, p_payments, p_items,
    COALESCE(p_discount, 0), COALESCE(p_surcharge, 0),
    p_supplier_payment, p_client_reference
  );
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.process_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb, text) FROM PUBLIC, anon;

CREATE FUNCTION public.create_order(
  p_org_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_delivery_address text,
  p_delivery_notes text,
  p_estimated_mins integer,
  p_delivery_fee numeric,
  p_discount numeric,
  p_payment_amount numeric,
  p_client_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_subtotal numeric := 0;
  v_total numeric;
  v_is_credit boolean;
  v_balance numeric;
  v_credit_limit numeric;
  v_customer_id uuid;
  v_existing_order_id uuid;
  v_existing_total numeric;
  v_result jsonb;
  v_order_id uuid;
  v_collected numeric;
  v_new_status text;
BEGIN
  IF NOT public.actor_has_org_permission(p_org_id, 'orders', 'create') THEN
    RAISE EXCEPTION 'No autorizado para crear pedidos' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(trim(COALESCE(p_client_reference, '')), '') IS NOT NULL THEN
    SELECT o.id, o.total INTO v_existing_order_id, v_existing_total
    FROM public.orders o
    WHERE o.organization_id = p_org_id
      AND o.client_reference = trim(p_client_reference)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order_id,
        'total', v_existing_total,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto';
  END IF;
  IF p_payment_amount IS NOT NULL AND (p_payment_amount < 0 OR p_payment_amount::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'El monto recibido no es válido';
  END IF;
  IF COALESCE(p_payment_amount, 0) > 0 AND NULLIF(trim(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Seleccioná un medio de pago para registrar el cobro';
  END IF;

  v_is_credit := lower(trim(COALESCE(p_payment_method, ''))) IN ('credit', 'current_account', 'cuenta_corriente', 'fiado');
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS items(value)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
  END LOOP;
  v_total := v_subtotal + COALESCE(p_delivery_fee, 0) - COALESCE(p_discount, 0);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'El total del pedido no puede ser negativo';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT c.id, COALESCE(c.balance, 0), COALESCE(c.credit_limit, 0)
      INTO v_customer_id, v_balance, v_credit_limit
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.organization_id = p_org_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente no encontrado en esta organización';
    END IF;
  ELSIF v_is_credit THEN
    RAISE EXCEPTION 'Para cuenta corriente debes seleccionar un cliente';
  END IF;

  IF v_is_credit AND v_credit_limit > 0 AND v_balance + v_total > v_credit_limit THEN
    RAISE EXCEPTION 'El pedido supera el límite de crédito disponible';
  END IF;
  IF v_is_credit AND COALESCE(p_payment_amount, 0) > 0 THEN
    RAISE EXCEPTION 'Para cuenta corriente, registrá el cobro inicial con un medio de pago separado';
  END IF;

  v_result := public.create_order_unchecked(
    p_org_id, p_customer_id, p_payment_method, p_items,
    p_delivery_address, p_delivery_notes, p_estimated_mins,
    COALESCE(p_delivery_fee, 0), COALESCE(p_discount, 0), p_payment_amount,
    NULLIF(trim(COALESCE(p_client_reference, '')), '')
  );
  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_order_id := (v_result->>'order_id')::uuid;
  IF NOT v_is_credit AND COALESCE(p_payment_amount, 0) > 0 THEN
    v_collected := LEAST(p_payment_amount, v_total);
    IF v_collected > 0 THEN
      INSERT INTO public.order_payments (
        organization_id, order_id, method, amount, notes, paid_by
      ) VALUES (
        p_org_id, v_order_id, lower(trim(p_payment_method)), v_collected,
        'Pago inicial al crear el pedido', auth.uid()
      );

      v_new_status := CASE WHEN v_collected >= v_total THEN 'paid' ELSE 'partial' END;
      UPDATE public.orders
      SET payment_status = v_new_status,
          payment_amount = v_collected,
          updated_at = now()
      WHERE id = v_order_id AND organization_id = p_org_id;

      INSERT INTO public.order_events (
        organization_id, order_id, event_type, payload, notes, created_by
      ) VALUES (
        p_org_id, v_order_id, 'payment_registered',
        jsonb_build_object('method', lower(trim(p_payment_method)), 'amount', v_collected, 'paid_total', v_collected),
        'Pago inicial al crear el pedido', auth.uid()
      );
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('payment_status', COALESCE(v_new_status, 'pending'));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION public.create_order(
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.create_order(
    p_org_id, p_customer_id, p_payment_method, p_items,
    p_delivery_address, p_delivery_notes, p_estimated_mins,
    p_delivery_fee, p_discount, p_payment_amount, NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, uuid, text, jsonb, text, text, integer, numeric, numeric, numeric) TO authenticated;

-- Keep the older offline RPC signature available, but route it through the checked mixed-payment implementation.
CREATE FUNCTION public.process_sale(
  p_org_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_items jsonb DEFAULT '[]'::jsonb,
  p_delivery_status text DEFAULT 'delivered',
  p_payment_status text DEFAULT 'paid',
  p_assigned_to uuid DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_discount numeric DEFAULT 0,
  p_channel text DEFAULT 'pos'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_method text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item jsonb;
  v_result jsonb;
  v_sale_id uuid;
BEGIN
  IF NOT public.actor_has_org_permission(p_org_id, 'sales', 'create') THEN
    RAISE EXCEPTION 'No autorizado para registrar ventas' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS items(value)
  LOOP
    v_subtotal := v_subtotal + COALESCE(
      NULLIF(v_item->>'subtotal', '')::numeric,
      NULLIF(v_item->>'total', '')::numeric,
      (v_item->>'quantity')::numeric * COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, NULLIF(v_item->>'price', '')::numeric)
    );
  END LOOP;
  v_total := v_subtotal - COALESCE(p_discount, 0);

  v_method := lower(trim(COALESCE(p_payment_method, 'cash')));
  IF lower(COALESCE(p_payment_status, '')) IN ('pending', 'partial')
     OR v_method IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
    v_method := 'credit';
  END IF;

  v_result := public.process_sale(
    p_org_id,
    p_customer_id,
    jsonb_build_array(jsonb_build_object('method', v_method, 'amount', v_total)),
    p_items,
    COALESCE(p_discount, 0),
    0,
    NULL,
    NULL
  );

  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_sale_id := (v_result->>'sale_id')::uuid;
  UPDATE public.sales
  SET delivery_status = p_delivery_status,
      payment_status = CASE WHEN v_method = 'credit' THEN 'pending' ELSE COALESCE(p_payment_status, 'paid') END,
      assigned_to = p_assigned_to,
      delivery_address = COALESCE(p_delivery_address, (
        SELECT c.address FROM public.customers c
        WHERE c.id = p_customer_id AND c.organization_id = p_org_id
      )),
      delivery_notes = p_delivery_notes,
      delivery_date = now(),
      channel = p_channel
  WHERE id = v_sale_id AND organization_id = p_org_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(uuid, uuid, text, jsonb, text, text, uuid, text, text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.process_sale(uuid, uuid, text, jsonb, text, text, uuid, text, text, numeric, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.register_customer_payment(
  p_org_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_new_balance numeric;
BEGIN
  IF NOT public.actor_has_org_permission(p_org_id, 'customers', 'edit') THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos de clientes' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = p_customer_id AND c.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado en esta organización';
  END IF;

  v_new_balance := COALESCE(v_customer.balance, 0) - p_amount;
  UPDATE public.customers
  SET balance = v_new_balance, updated_at = now()
  WHERE id = p_customer_id AND organization_id = p_org_id;

  INSERT INTO public.customer_account_movements (
    customer_id, organization_id, type, amount, description
  ) VALUES (
    p_customer_id, p_org_id, 'payment', p_amount, COALESCE(p_description, 'Pago a cuenta')
  );

  RETURN jsonb_build_object(
    'success', true,
    'customer_name', v_customer.name,
    'previous_balance', COALESCE(v_customer.balance, 0),
    'payment_amount', p_amount,
    'new_balance', v_new_balance
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_payment(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_customer_payment(uuid, uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_order_payment(
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_paid_total numeric;
  v_new_paid_total numeric;
  v_remaining numeric;
  v_new_payment_status text;
  v_credit_method boolean;
BEGIN
  IF NOT (
    public.actor_has_org_permission(p_org_id, 'delivery', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'sales', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'customers', 'edit')
  ) THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos de pedidos' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR NULLIF(trim(COALESCE(p_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Monto o método de pago inválido';
  END IF;
  IF lower(p_method) IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
    RAISE EXCEPTION 'El pago debe usar un medio de cobro';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado en esta organización';
  END IF;
  IF lower(COALESCE(v_order.payment_status, '')) = 'paid' THEN
    RAISE EXCEPTION 'El pedido ya está saldado';
  END IF;

  SELECT COALESCE(SUM(op.amount), 0) INTO v_paid_total
  FROM public.order_payments op
  WHERE op.organization_id = p_org_id AND op.order_id = p_order_id;
  v_paid_total := GREATEST(v_paid_total, COALESCE(v_order.payment_amount, 0));
  v_remaining := GREATEST(COALESCE(v_order.total, 0) - v_paid_total, 0);
  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente del pedido';
  END IF;

  INSERT INTO public.order_payments (
    organization_id, order_id, method, amount, reference, notes, paid_by
  ) VALUES (
    p_org_id, p_order_id, lower(trim(p_method)), p_amount, p_reference, p_notes, auth.uid()
  );

  v_new_paid_total := v_paid_total + p_amount;
  v_new_payment_status := CASE
    WHEN v_new_paid_total >= COALESCE(v_order.total, 0) THEN 'paid'
    WHEN v_new_paid_total > 0 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.orders
  SET payment_status = v_new_payment_status,
      payment_amount = v_new_paid_total,
      payment_method = COALESCE(payment_method, lower(trim(p_method))),
      updated_at = now()
  WHERE id = p_order_id AND organization_id = p_org_id;

  INSERT INTO public.order_events (
    organization_id, order_id, event_type, payload, notes, created_by
  ) VALUES (
    p_org_id, p_order_id, 'payment_registered',
    jsonb_build_object('method', lower(trim(p_method)), 'amount', p_amount, 'paid_total', v_new_paid_total),
    p_notes, auth.uid()
  );

  v_credit_method := v_order.customer_id IS NOT NULL
    AND lower(COALESCE(v_order.payment_method, '')) IN ('credit', 'current_account', 'cuenta_corriente', 'fiado', 'mixed');
  IF v_credit_method THEN
    UPDATE public.customers
    SET balance = COALESCE(balance, 0) - p_amount, updated_at = now()
    WHERE id = v_order.customer_id AND organization_id = p_org_id;

    INSERT INTO public.customer_account_movements (
      customer_id, organization_id, sale_id, type, amount, description
    ) VALUES (
      v_order.customer_id, p_org_id, NULL, 'payment', p_amount,
      COALESCE(p_notes, 'Pago de pedido delivery #' || left(v_order.id::text, 8))
    );
  END IF;

  IF lower(trim(p_method)) = 'cash' THEN
    UPDATE public.delivery_shifts
    SET collected_cash = collected_cash + p_amount
    WHERE driver_id = auth.uid() AND organization_id = p_org_id AND status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'paid_total', v_new_paid_total,
    'payment_status', v_new_payment_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_payment(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_order_payment(uuid, uuid, text, numeric, text, text) TO authenticated;

CREATE FUNCTION public.register_order_settlement(
  p_org_id uuid,
  p_order_id uuid,
  p_payments jsonb,
  p_final_payment_method text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_method text;
  v_amount numeric;
  v_paid_before numeric;
  v_remaining numeric;
  v_allocated numeric := 0;
  v_cash_amount numeric := 0;
  v_credit_amount numeric := 0;
  v_new_paid_total numeric;
  v_new_status text;
  v_original_credit boolean;
  v_customer_balance numeric;
  v_customer_credit_limit numeric;
  v_effective_method text;
BEGIN
  IF NOT (
    public.actor_has_org_permission(p_org_id, 'orders', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'delivery', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'sales', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'customers', 'edit')
  ) THEN
    RAISE EXCEPTION 'No autorizado para registrar el cobro de pedidos' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(COALESCE(p_final_payment_method, '')), '') IS NULL
     OR jsonb_typeof(p_payments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'El medio o el detalle de pago no es válido';
  END IF;
  IF jsonb_array_length(p_payments) > 20 THEN
    RAISE EXCEPTION 'El pedido supera el máximo de medios de pago';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado en esta organización';
  END IF;

  SELECT COALESCE(SUM(op.amount), 0) INTO v_paid_before
  FROM public.order_payments op
  WHERE op.organization_id = p_org_id AND op.order_id = p_order_id;
  v_paid_before := GREATEST(v_paid_before, COALESCE(v_order.payment_amount, 0));
  v_remaining := GREATEST(COALESCE(v_order.total, 0) - v_paid_before, 0);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payments) AS payments(value)
  LOOP
    v_method := lower(trim(COALESCE(v_item->>'method', '')));
    v_amount := NULLIF(v_item->>'amount', '')::numeric;
    IF v_method = '' OR v_amount IS NULL OR v_amount <= 0
       OR v_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Cada medio de pago debe tener un monto mayor a cero';
    END IF;

    v_allocated := v_allocated + v_amount;
    IF v_method IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
      v_credit_amount := v_credit_amount + v_amount;
    ELSE
      v_cash_amount := v_cash_amount + v_amount;
    END IF;
  END LOOP;

  IF v_remaining = 0 AND v_allocated = 0 THEN
    NULL;
  ELSIF abs(v_allocated - v_remaining) > 0.05 THEN
    RAISE EXCEPTION 'Los medios de pago deben cubrir el saldo pendiente del pedido';
  END IF;
  IF v_allocated > v_remaining + 0.05 THEN
    RAISE EXCEPTION 'El cobro supera el saldo pendiente del pedido';
  END IF;
  IF v_credit_amount > 0 AND v_order.customer_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere un cliente para dejar saldo en cuenta corriente';
  END IF;

  v_original_credit := lower(COALESCE(v_order.payment_method, ''))
    IN ('credit', 'fiado', 'current_account', 'cuenta_corriente', 'mixed');
  IF v_order.customer_id IS NOT NULL AND ((v_original_credit AND v_cash_amount > 0) OR (NOT v_original_credit AND v_credit_amount > 0)) THEN
    SELECT COALESCE(c.balance, 0), COALESCE(c.credit_limit, 0)
      INTO v_customer_balance, v_customer_credit_limit
    FROM public.customers c
    WHERE c.id = v_order.customer_id AND c.organization_id = p_org_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente no encontrado en esta organización';
    END IF;
    IF NOT v_original_credit AND v_credit_amount > 0
       AND v_customer_credit_limit > 0
       AND v_customer_balance + v_credit_amount > v_customer_credit_limit THEN
      RAISE EXCEPTION 'El saldo supera el límite de crédito del cliente';
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payments) AS payments(value)
  LOOP
    v_method := lower(trim(COALESCE(v_item->>'method', '')));
    v_amount := (v_item->>'amount')::numeric;
    IF v_method NOT IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
      INSERT INTO public.order_payments (
        organization_id, order_id, method, amount, notes, paid_by
      ) VALUES (
        p_org_id, p_order_id, v_method, v_amount, p_notes, auth.uid()
      );
    END IF;
  END LOOP;

  IF v_original_credit AND v_cash_amount > 0 THEN
    UPDATE public.customers
    SET balance = v_customer_balance - v_cash_amount, updated_at = now()
    WHERE id = v_order.customer_id AND organization_id = p_org_id;
    INSERT INTO public.customer_account_movements (
      customer_id, organization_id, sale_id, type, amount, description
    ) VALUES (
      v_order.customer_id, p_org_id, NULL, 'payment', v_cash_amount,
      COALESCE(p_notes, 'Pago de pedido delivery #' || left(p_order_id::text, 8))
    );
  ELSIF NOT v_original_credit AND v_credit_amount > 0 THEN
    UPDATE public.customers
    SET balance = v_customer_balance + v_credit_amount, updated_at = now()
    WHERE id = v_order.customer_id AND organization_id = p_org_id;
    INSERT INTO public.customer_account_movements (
      customer_id, organization_id, sale_id, type, amount, description
    ) VALUES (
      v_order.customer_id, p_org_id, NULL, 'charge', v_credit_amount,
      COALESCE(p_notes, 'Cargo por saldo de pedido delivery #' || left(p_order_id::text, 8))
    );
  END IF;

  v_new_paid_total := v_paid_before + v_cash_amount;
  v_new_status := CASE
    WHEN v_credit_amount > 0 AND v_new_paid_total = 0 THEN 'pending'
    WHEN v_credit_amount > 0 THEN 'partial'
    WHEN v_new_paid_total >= COALESCE(v_order.total, 0) THEN 'paid'
    WHEN v_new_paid_total > 0 THEN 'partial'
    ELSE 'pending'
  END;
  v_effective_method := CASE
    WHEN v_remaining = 0 AND v_allocated = 0
      THEN COALESCE(NULLIF(lower(trim(v_order.payment_method)), ''), lower(trim(p_final_payment_method)))
    WHEN v_credit_amount > 0 AND v_cash_amount > 0 THEN 'mixed'
    WHEN v_credit_amount > 0 THEN 'credit'
    ELSE lower(trim(p_final_payment_method))
  END;

  UPDATE public.orders
  SET payment_status = v_new_status,
      payment_method = v_effective_method,
      payment_amount = v_new_paid_total,
      lifecycle_status = 'delivered',
      status = 'delivered',
      delivery_status = 'delivered',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id AND organization_id = p_org_id;

  INSERT INTO public.order_events (
    organization_id, order_id, event_type, payload, notes, created_by
  ) VALUES (
    p_org_id, p_order_id, 'payment_registered',
    jsonb_build_object(
      'cash_collected', v_cash_amount,
      'credit_added', CASE WHEN v_original_credit THEN 0 ELSE v_credit_amount END,
      'paid_total', v_new_paid_total,
      'payment_status', v_new_status
    ),
    p_notes, auth.uid()
  );

  INSERT INTO public.order_events (
    organization_id, order_id, event_type, from_status, to_status, notes, created_by
  ) VALUES (
    p_org_id, p_order_id, 'status_changed', v_order.lifecycle_status, 'delivered', p_notes, auth.uid()
  );

  UPDATE public.delivery_shifts
  SET collected_cash = collected_cash + COALESCE((
    SELECT SUM((payment->>'amount')::numeric)
    FROM jsonb_array_elements(p_payments) AS payments(payment)
    WHERE lower(COALESCE(payment->>'method', '')) = 'cash'
  ), 0)
  WHERE driver_id = auth.uid() AND organization_id = p_org_id AND status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'cash_collected', v_cash_amount,
    'credit_amount', v_credit_amount,
    'payment_status', v_new_status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_settlement(uuid, uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_order_settlement(uuid, uuid, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_sale_payment(
  p_org_id uuid,
  p_sale_id uuid,
  p_method text,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_customer_balance numeric;
  v_paid_total numeric;
  v_new_paid_total numeric;
  v_remaining numeric;
  v_payment_status text;
BEGIN
  IF NOT (
    public.actor_has_org_permission(p_org_id, 'delivery', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'sales', 'edit')
    OR public.actor_has_org_permission(p_org_id, 'customers', 'edit')
  ) THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos de ventas' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR NULLIF(trim(COALESCE(p_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Monto o método de pago inválido';
  END IF;
  IF lower(p_method) IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
    RAISE EXCEPTION 'El pago debe usar un medio de cobro';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada en esta organización';
  END IF;
  IF lower(COALESCE(v_sale.payment_status, '')) NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'La venta no tiene un pago pendiente';
  END IF;
  IF v_sale.customer_id IS NULL
     OR lower(COALESCE(v_sale.payment_method, '')) NOT IN ('credit', 'fiado', 'current_account', 'cuenta_corriente', 'mixed') THEN
    RAISE EXCEPTION 'La venta no tiene saldo en cuenta corriente';
  END IF;

  SELECT COALESCE(SUM(sp.amount), 0) INTO v_paid_total
  FROM public.sale_payments sp
  WHERE sp.organization_id = p_org_id
    AND sp.sale_id = p_sale_id
    AND lower(COALESCE(sp.payment_method, '')) NOT IN ('credit', 'fiado', 'current_account', 'cuenta_corriente');
  v_remaining := GREATEST(COALESCE(v_sale.total, 0) - v_paid_total, 0);
  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente de la venta';
  END IF;

  SELECT COALESCE(c.balance, 0) INTO v_customer_balance
  FROM public.customers c
  WHERE c.id = v_sale.customer_id AND c.organization_id = p_org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado en esta organización';
  END IF;

  INSERT INTO public.sale_payments (sale_id, organization_id, payment_method, amount)
  VALUES (p_sale_id, p_org_id, lower(trim(p_method)), p_amount);

  v_new_paid_total := v_paid_total + p_amount;
  v_payment_status := CASE
    WHEN v_new_paid_total >= COALESCE(v_sale.total, 0) THEN 'paid'
    WHEN v_new_paid_total > 0 THEN 'partial'
    ELSE 'pending'
  END;
  UPDATE public.sales
  SET payment_status = v_payment_status
  WHERE id = p_sale_id AND organization_id = p_org_id;

  UPDATE public.customers
  SET balance = v_customer_balance - p_amount, updated_at = now()
  WHERE id = v_sale.customer_id AND organization_id = p_org_id;
  INSERT INTO public.customer_account_movements (
    customer_id, organization_id, sale_id, type, amount, description
  ) VALUES (
    v_sale.customer_id, p_org_id, p_sale_id, 'payment', p_amount,
    COALESCE(p_notes, 'Pago de venta #' || left(p_sale_id::text, 8))
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'paid_total', v_new_paid_total,
    'remaining', GREATEST(COALESCE(v_sale.total, 0) - v_new_paid_total, 0),
    'payment_status', v_payment_status,
    'new_balance', v_customer_balance - p_amount
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_sale_payment(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_sale_payment(uuid, uuid, text, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.import_customer_account_movements(
  p_org_id uuid,
  p_movements jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_customer_ids uuid[];
  v_customer_count integer;
  v_inserted_count integer;
BEGIN
  IF NOT public.actor_has_org_permission(p_org_id, 'customers', 'edit') THEN
    RAISE EXCEPTION 'No autorizado para importar movimientos de clientes' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_movements) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La lista de movimientos no es válida';
  END IF;
  IF jsonb_array_length(p_movements) > 10000 THEN
    RAISE EXCEPTION 'El archivo supera el máximo de 10000 movimientos por importación';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_movements) AS m(customer_id uuid, type text, amount numeric)
    WHERE m.customer_id IS NULL
       OR m.type IS NULL
       OR m.type NOT IN ('charge', 'payment')
       OR m.amount IS NULL
       OR m.amount <= 0
       OR m.amount::text IN ('NaN', 'Infinity', '-Infinity')
  ) THEN
    RAISE EXCEPTION 'Cada movimiento requiere cliente, tipo válido y monto mayor a cero';
  END IF;

  SELECT array_agg(DISTINCT m.customer_id ORDER BY m.customer_id)
    INTO v_customer_ids
  FROM jsonb_to_recordset(p_movements) AS m(customer_id uuid);

  SELECT count(*) INTO v_customer_count
  FROM public.customers c
  WHERE c.organization_id = p_org_id
    AND c.id = ANY(COALESCE(v_customer_ids, ARRAY[]::uuid[]));
  IF v_customer_count <> COALESCE(cardinality(v_customer_ids), 0) THEN
    RAISE EXCEPTION 'Uno o más clientes no pertenecen a esta organización';
  END IF;

  PERFORM c.id
  FROM public.customers c
  WHERE c.organization_id = p_org_id
    AND c.id = ANY(COALESCE(v_customer_ids, ARRAY[]::uuid[]))
  ORDER BY c.id
  FOR UPDATE;

  INSERT INTO public.customer_account_movements (
    customer_id, organization_id, type, amount, description, created_at
  )
  SELECT m.customer_id, p_org_id, m.type, m.amount, m.description, COALESCE(m.created_at, now())
  FROM jsonb_to_recordset(p_movements) AS m(
    customer_id uuid,
    type text,
    amount numeric,
    description text,
    created_at timestamptz
  );
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE public.customers c
  SET balance = COALESCE(c.balance, 0) + changes.balance_change,
      updated_at = now()
  FROM (
    SELECT m.customer_id,
      SUM(CASE WHEN m.type = 'charge' THEN m.amount ELSE -m.amount END) AS balance_change
    FROM jsonb_to_recordset(p_movements) AS m(customer_id uuid, type text, amount numeric)
    GROUP BY m.customer_id
  ) changes
  WHERE c.id = changes.customer_id
    AND c.organization_id = p_org_id;

  RETURN jsonb_build_object('success', true, 'inserted_count', v_inserted_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.import_customer_account_movements(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_customer_account_movements(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_customer_opening_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.balance IS NOT NULL AND NEW.balance <> 0 THEN
    IF NEW.balance::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'El saldo inicial no es válido';
    END IF;

    INSERT INTO public.customer_account_movements (
      customer_id, organization_id, type, amount, description
    ) VALUES (
      NEW.id,
      NEW.organization_id,
      CASE WHEN NEW.balance > 0 THEN 'charge' ELSE 'payment' END,
      abs(NEW.balance),
      'Saldo inicial importado'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_opening_balance_movement ON public.customers;
CREATE TRIGGER customer_opening_balance_movement
AFTER INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.record_customer_opening_balance();
REVOKE ALL ON FUNCTION public.record_customer_opening_balance() FROM PUBLIC, anon, authenticated;
