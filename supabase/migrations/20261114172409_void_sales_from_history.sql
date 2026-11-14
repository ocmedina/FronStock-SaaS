ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.void_sale_from_history(
  p_sale_id uuid,
  p_org_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_item record;
  v_product record;
  v_new_stock numeric;
  v_credit_amount numeric := 0;
  v_customer_balance numeric;
  v_before_data jsonb;
  v_after_data jsonb;
BEGIN
  IF p_sale_id IS NULL OR p_org_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos para anular la venta';
  END IF;

  IF length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Ingresá un motivo de al menos 3 caracteres';
  END IF;

  IF length(btrim(p_reason)) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar los 300 caracteres';
  END IF;

  SELECT *
    INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta en esta organización';
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'sale_id', v_sale.id);
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Solo se pueden anular ventas completadas';
  END IF;

  IF v_sale.route_id IS NOT NULL OR v_sale.route_stop_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta venta está asociada a una ruta; anulala desde el módulo de logística';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.sale_id = v_sale.id
      AND i.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Esta venta tiene un comprobante vinculado; gestioná primero la nota de crédito';
  END IF;

  v_before_data := to_jsonb(v_sale);

  -- Agrupar renglones repetidos para actualizar y auditar cada producto una sola vez.
  FOR v_item IN
    SELECT product_id, max(product_name) AS product_name, sum(quantity)::numeric AS quantity
    FROM public.sale_items
    WHERE sale_id = v_sale.id
    GROUP BY product_id
    ORDER BY product_id
  LOOP
    SELECT id, name, COALESCE(stock, 0) AS stock
      INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
      AND organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se pudo restituir el stock de un producto de la venta';
    END IF;

    v_new_stock := v_product.stock + v_item.quantity;

    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = now()
    WHERE id = v_product.id
      AND organization_id = p_org_id;

    INSERT INTO public.stock_movements (
      organization_id,
      product_id,
      product_name,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      reference_type,
      reference_id,
      notes,
      created_by
    ) VALUES (
      p_org_id,
      v_product.id,
      COALESCE(v_product.name, v_item.product_name),
      'entry',
      v_item.quantity,
      v_product.stock,
      v_new_stock,
      'Anulación de venta',
      'sale_cancellation',
      v_sale.id,
      'Venta #' || COALESCE(v_sale.sale_number::text, left(v_sale.id::text, 8)) || ': ' || btrim(p_reason),
      p_actor_user_id
    );
  END LOOP;

  -- Revertir el cargo de cuenta corriente sin borrar el movimiento original.
  SELECT COALESCE(sum(m.amount), 0)
    INTO v_credit_amount
  FROM public.customer_account_movements m
  WHERE m.organization_id = p_org_id
    AND m.sale_id = v_sale.id
    AND m.type = 'charge';

  IF v_credit_amount <= 0 THEN
    SELECT COALESCE(sum(p.amount), 0)
      INTO v_credit_amount
    FROM public.sale_payments p
    WHERE p.organization_id = p_org_id
      AND p.sale_id = v_sale.id
      AND p.payment_method = 'credit';
  END IF;

  IF v_credit_amount <= 0
     AND lower(COALESCE(v_sale.payment_method, '')) IN ('credit', 'fiado', 'current_account', 'cuenta_corriente') THEN
    v_credit_amount := COALESCE(v_sale.total, 0);
  END IF;

  IF v_credit_amount > 0 THEN
    IF v_sale.customer_id IS NULL THEN
      RAISE EXCEPTION 'La venta tiene un saldo a crédito sin cliente asociado';
    END IF;

    SELECT COALESCE(c.balance, 0)
      INTO v_customer_balance
    FROM public.customers c
    WHERE c.id = v_sale.customer_id
      AND c.organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró el cliente para revertir la cuenta corriente';
    END IF;

    UPDATE public.customers
    SET balance = v_customer_balance - v_credit_amount,
        updated_at = now()
    WHERE id = v_sale.customer_id
      AND organization_id = p_org_id;

    INSERT INTO public.customer_account_movements (
      customer_id,
      organization_id,
      sale_id,
      type,
      amount,
      description
    ) VALUES (
      v_sale.customer_id,
      p_org_id,
      v_sale.id,
      'payment',
      v_credit_amount,
      'Reversión de cuenta corriente por anulación de venta: ' || btrim(p_reason)
    );
  END IF;

  UPDATE public.sales AS s
  SET status = 'cancelled',
      payment_status = 'cancelled',
      delivery_status = CASE WHEN s.channel = 'delivery' THEN 'cancelled' ELSE s.delivery_status END,
      cancelled_at = now(),
      cancelled_by = p_actor_user_id,
      cancellation_reason = btrim(p_reason)
  WHERE s.id = v_sale.id
    AND s.organization_id = p_org_id
  RETURNING to_jsonb(s) INTO v_after_data;

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity,
    entity_id,
    before_data,
    after_data,
    metadata
  ) VALUES (
    p_org_id,
    p_actor_user_id,
    'custom',
    'sales',
    v_sale.id::text,
    v_before_data,
    v_after_data,
    jsonb_build_object(
      'event', 'sale_cancelled',
      'reason', btrim(p_reason),
      'credit_reversed', v_credit_amount
    )
  );

  RETURN jsonb_build_object('success', true, 'already_cancelled', false, 'sale_id', v_sale.id);
END;
$$;

REVOKE ALL ON FUNCTION public.void_sale_from_history(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale_from_history(uuid, uuid, uuid, text) TO service_role;
