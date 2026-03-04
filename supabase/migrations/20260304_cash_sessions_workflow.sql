-- =============================================================================
-- MIGRACIÓN: FLUJO OPERATIVO DE CAJA (APERTURA / CIERRE)
-- Fecha: 2026-03-04
-- =============================================================================

CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_registers_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_org
  ON cash_registers (organization_id);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
  opened_by uuid REFERENCES auth.users(id),
  closed_by uuid REFERENCES auth.users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_amount numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  difference_cash numeric(12,2),
  open_notes text,
  close_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_org
  ON cash_sessions (organization_id, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open_per_org
  ON cash_sessions (organization_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS cash_session_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_session_audit_org
  ON cash_session_audit (organization_id, created_at DESC);

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_session_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash registers from their organization"
  ON cash_registers FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert cash registers in their organization"
  ON cash_registers FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update cash registers in their organization"
  ON cash_registers FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can view cash sessions from their organization"
  ON cash_sessions FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert cash sessions in their organization"
  ON cash_sessions FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update cash sessions in their organization"
  ON cash_sessions FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can view cash session audit from their organization"
  ON cash_session_audit FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert cash session audit in their organization"
  ON cash_session_audit FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE OR REPLACE FUNCTION open_cash_session(
  p_org_id uuid,
  p_opening_amount numeric DEFAULT 0,
  p_register_name text DEFAULT 'Caja Principal',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_register_id uuid;
  v_session_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'No autorizado para abrir caja en esta organización';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cash_sessions
    WHERE organization_id = p_org_id
      AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Ya existe una caja abierta para esta organización';
  END IF;

  INSERT INTO cash_registers (organization_id, name)
  VALUES (p_org_id, COALESCE(NULLIF(trim(p_register_name), ''), 'Caja Principal'))
  ON CONFLICT (organization_id, name) DO UPDATE SET
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_register_id;

  INSERT INTO cash_sessions (
    organization_id,
    register_id,
    opened_by,
    opened_at,
    status,
    opening_amount,
    open_notes,
    updated_at
  ) VALUES (
    p_org_id,
    v_register_id,
    auth.uid(),
    now(),
    'open',
    COALESCE(p_opening_amount, 0),
    p_notes,
    now()
  ) RETURNING id INTO v_session_id;

  INSERT INTO cash_session_audit (
    organization_id,
    session_id,
    event_type,
    event_payload,
    created_by
  ) VALUES (
    p_org_id,
    v_session_id,
    'session_opened',
    jsonb_build_object(
      'opening_amount', COALESCE(p_opening_amount, 0),
      'notes', p_notes
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION close_cash_session(
  p_org_id uuid,
  p_counted_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
  v_local_cash numeric := 0;
  v_local_cash_mixed numeric := 0;
  v_delivery_cash numeric := 0;
  v_expenses_cash numeric := 0;
  v_expected_cash numeric := 0;
  v_difference numeric := 0;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id requerido';
  END IF;

  IF p_counted_cash IS NULL THEN
    RAISE EXCEPTION 'Debe informar efectivo contado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'No autorizado para cerrar caja en esta organización';
  END IF;

  SELECT *
    INTO v_session
  FROM cash_sessions
  WHERE organization_id = p_org_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'No hay caja abierta para cerrar';
  END IF;

  SELECT COALESCE(SUM(s.total), 0)
    INTO v_local_cash
  FROM sales s
  WHERE s.organization_id = p_org_id
    AND s.status = 'completed'
    AND COALESCE(s.channel, 'pos') = 'pos'
    AND s.payment_method = 'cash'
    AND s.created_at >= v_session.opened_at
    AND s.created_at <= now();

  SELECT COALESCE(SUM(sp.amount), 0)
    INTO v_local_cash_mixed
  FROM sale_payments sp
  JOIN sales s ON s.id = sp.sale_id
  WHERE sp.organization_id = p_org_id
    AND sp.payment_method = 'cash'
    AND s.status = 'completed'
    AND s.created_at >= v_session.opened_at
    AND s.created_at <= now();

  SELECT COALESCE(SUM(op.amount), 0)
    INTO v_delivery_cash
  FROM order_payments op
  WHERE op.organization_id = p_org_id
    AND op.method = 'cash'
    AND op.paid_at >= v_session.opened_at
    AND op.paid_at <= now();

  SELECT COALESCE(SUM(sp.amount), 0)
    INTO v_expenses_cash
  FROM supplier_payments sp
  WHERE sp.organization_id = p_org_id
    AND lower(COALESCE(sp.payment_method, '')) IN ('cash', 'efectivo', 'cash_from_sales')
    AND sp.payment_date >= (v_session.opened_at::date)
    AND sp.payment_date <= (now()::date);

  v_expected_cash := COALESCE(v_session.opening_amount, 0)
    + COALESCE(v_local_cash, 0)
    + COALESCE(v_local_cash_mixed, 0)
    + COALESCE(v_delivery_cash, 0)
    - COALESCE(v_expenses_cash, 0);

  v_difference := COALESCE(p_counted_cash, 0) - COALESCE(v_expected_cash, 0);

  UPDATE cash_sessions
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid(),
    expected_cash = v_expected_cash,
    counted_cash = p_counted_cash,
    difference_cash = v_difference,
    close_notes = p_notes,
    updated_at = now()
  WHERE id = v_session.id;

  INSERT INTO cash_session_audit (
    organization_id,
    session_id,
    event_type,
    event_payload,
    created_by
  ) VALUES (
    p_org_id,
    v_session.id,
    'session_closed',
    jsonb_build_object(
      'expected_cash', v_expected_cash,
      'counted_cash', p_counted_cash,
      'difference_cash', v_difference,
      'notes', p_notes
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'expected_cash', v_expected_cash,
    'counted_cash', p_counted_cash,
    'difference_cash', v_difference
  );
END;
$$;
