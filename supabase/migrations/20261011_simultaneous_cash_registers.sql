-- Multiple simultaneous cash registers.
-- Keeps one open session per register and preserves the existing main register.

DROP INDEX IF EXISTS idx_cash_sessions_one_open_per_org;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open_per_register
  ON cash_sessions (register_id)
  WHERE status = 'open';

INSERT INTO cash_registers (organization_id, name, code)
SELECT id, 'Caja Principal', 'MAIN'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1
  FROM cash_registers
  WHERE cash_registers.organization_id = organizations.id
);

ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL;

ALTER TABLE cash_closings
  DROP CONSTRAINT IF EXISTS cash_closings_org_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closings_one_per_session
  ON cash_closings (cash_session_id)
  WHERE cash_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cash_register_users (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (register_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_register_users_org
  ON cash_register_users (organization_id, user_id);

ALTER TABLE cash_register_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash register assignments from their organization"
  ON cash_register_users FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage cash register assignments"
  ON cash_register_users FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE OR REPLACE FUNCTION user_can_use_cash_register(
  p_org_id uuid,
  p_register_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_user_id
      AND p.organization_id = p_org_id
      AND (
        p.role IN ('owner', 'admin', 'manager')
        OR NOT EXISTS (
          SELECT 1
          FROM cash_register_users cru
          WHERE cru.organization_id = p_org_id
            AND cru.register_id = p_register_id
        )
        OR EXISTS (
          SELECT 1
          FROM cash_register_users cru
          WHERE cru.organization_id = p_org_id
            AND cru.register_id = p_register_id
            AND cru.user_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION open_cash_session_for_register(
  p_org_id uuid,
  p_register_id uuid,
  p_opening_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_register_name text;
BEGIN
  IF NOT user_can_use_cash_register(p_org_id, p_register_id) THEN
    RAISE EXCEPTION 'No autorizado para abrir esta caja';
  END IF;

  SELECT name
  INTO v_register_name
  FROM cash_registers
  WHERE id = p_register_id
    AND organization_id = p_org_id
    AND is_active = true;

  IF v_register_name IS NULL THEN
    RAISE EXCEPTION 'La caja no existe o está inactiva';
  END IF;

  INSERT INTO cash_sessions (
    organization_id, register_id, opened_by, opening_amount, open_notes
  ) VALUES (
    p_org_id, p_register_id, auth.uid(), COALESCE(p_opening_amount, 0), p_notes
  )
  RETURNING id INTO v_session_id;

  INSERT INTO cash_session_audit (
    organization_id, session_id, event_type, event_payload, created_by
  ) VALUES (
    p_org_id,
    v_session_id,
    'session_opened',
    jsonb_build_object(
      'register_id', p_register_id,
      'register_name', v_register_name,
      'opening_amount', COALESCE(p_opening_amount, 0),
      'notes', p_notes
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'register_id', p_register_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'La caja ya tiene una sesión abierta';
END;
$$;

CREATE OR REPLACE FUNCTION close_cash_session_for_register(
  p_org_id uuid,
  p_session_id uuid,
  p_counted_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session cash_sessions%ROWTYPE;
  v_expected_cash numeric := 0;
  v_difference numeric := 0;
BEGIN
  SELECT *
  INTO v_session
  FROM cash_sessions
  WHERE id = p_session_id
    AND organization_id = p_org_id
    AND status = 'open'
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'La sesión no existe, no pertenece a la organización o ya está cerrada';
  END IF;

  IF NOT user_can_use_cash_register(p_org_id, v_session.register_id) THEN
    RAISE EXCEPTION 'No autorizado para cerrar esta caja';
  END IF;

  SELECT COALESCE(v_session.opening_amount, 0)
    + COALESCE(SUM(CASE WHEN lower(COALESCE(sp.payment_method, '')) IN ('cash', 'efectivo', 'cash_from_sales')
                        THEN sp.amount ELSE 0 END), 0)
  INTO v_expected_cash
  FROM sale_payments sp
  JOIN sales s ON s.id = sp.sale_id
  WHERE sp.organization_id = p_org_id
    AND s.status = 'completed'
    AND s.created_at >= v_session.opened_at
    AND s.created_at <= now();

  v_difference := COALESCE(p_counted_cash, 0) - v_expected_cash;

  UPDATE cash_sessions
  SET status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      expected_cash = v_expected_cash,
      counted_cash = p_counted_cash,
      difference_cash = v_difference,
      close_notes = p_notes,
      updated_at = now()
  WHERE id = p_session_id;

  INSERT INTO cash_session_audit (
    organization_id, session_id, event_type, event_payload, created_by
  ) VALUES (
    p_org_id,
    p_session_id,
    'session_closed',
    jsonb_build_object(
      'register_id', v_session.register_id,
      'expected_cash', v_expected_cash,
      'counted_cash', p_counted_cash,
      'difference_cash', v_difference,
      'notes', p_notes
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'register_id', v_session.register_id,
    'expected_cash', v_expected_cash,
    'counted_cash', p_counted_cash,
    'difference_cash', v_difference
  );
END;
$$;

GRANT EXECUTE ON FUNCTION user_can_use_cash_register(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION open_cash_session_for_register(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION close_cash_session_for_register(uuid, uuid, numeric, text) TO authenticated;
