-- Atomic assignment of cash registers to organization users.

CREATE OR REPLACE FUNCTION replace_cash_register_user_assignments(
  p_org_id uuid,
  p_user_id uuid,
  p_register_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado para asignar cajas';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id
      AND organization_id = p_org_id
      AND role = 'employee'
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado no es un vendedor de esta organización';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_register_ids, ARRAY[]::uuid[])) AS selected(selected_register_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM cash_registers
      WHERE id = selected.selected_register_id
        AND organization_id = p_org_id
        AND is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Una o más cajas no existen, están inactivas o no pertenecen a la organización';
  END IF;

  DELETE FROM cash_register_users
  WHERE organization_id = p_org_id
    AND user_id = p_user_id;

  INSERT INTO cash_register_users (organization_id, register_id, user_id)
  SELECT p_org_id, selected_register_id, p_user_id
  FROM unnest(COALESCE(p_register_ids, ARRAY[]::uuid[])) AS selected(selected_register_id);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_cash_register_user_assignments(uuid, uuid, uuid[]) TO authenticated;
