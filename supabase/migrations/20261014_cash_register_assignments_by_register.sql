-- Replace all employee assignments for one cash register atomically.

CREATE OR REPLACE FUNCTION replace_cash_register_assignments(
  p_org_id uuid,
  p_register_id uuid,
  p_user_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado para asignar vendedores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cash_registers
    WHERE id = p_register_id
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'La caja no existe en esta organización';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS selected(user_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = selected.user_id
        AND organization_id = p_org_id
        AND role = 'employee'
    )
  ) THEN
    RAISE EXCEPTION 'Solo se pueden asignar usuarios vendedores de esta organización';
  END IF;

  DELETE FROM cash_register_users
  WHERE organization_id = p_org_id
    AND register_id = p_register_id;

  INSERT INTO cash_register_users (organization_id, register_id, user_id)
  SELECT p_org_id, p_register_id, selected.user_id
  FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS selected(user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_cash_register_assignments(uuid, uuid, uuid[]) TO authenticated;
