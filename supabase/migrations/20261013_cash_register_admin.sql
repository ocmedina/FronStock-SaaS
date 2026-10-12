-- Administrative API for creating and maintaining cash registers.

CREATE OR REPLACE FUNCTION manage_cash_register(
  p_org_id uuid,
  p_action text,
  p_register_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register cash_registers%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('owner', 'admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado para administrar cajas';
  END IF;

  IF p_action = 'create' THEN
    IF NULLIF(trim(COALESCE(p_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'El nombre de la caja es obligatorio';
    END IF;

    INSERT INTO cash_registers (organization_id, name, code, is_active)
    VALUES (p_org_id, trim(p_name), NULLIF(trim(COALESCE(p_code, '')), ''), true)
    RETURNING * INTO v_register;
  ELSIF p_action IN ('update', 'set_active') THEN
    IF p_register_id IS NULL THEN
      RAISE EXCEPTION 'La caja es obligatoria';
    END IF;

    UPDATE cash_registers
    SET name = CASE WHEN p_action = 'update' THEN trim(COALESCE(p_name, name)) ELSE name END,
        code = CASE WHEN p_action = 'update' THEN NULLIF(trim(COALESCE(p_code, '')), '') ELSE code END,
        is_active = CASE WHEN p_action = 'set_active' THEN COALESCE(p_is_active, false) ELSE is_active END,
        updated_at = now()
    WHERE id = p_register_id
      AND organization_id = p_org_id
    RETURNING * INTO v_register;

    IF v_register.id IS NULL THEN
      RAISE EXCEPTION 'La caja no existe en esta organización';
    END IF;
  ELSE
    RAISE EXCEPTION 'Operación de caja no válida';
  END IF;

  RETURN jsonb_build_object(
    'id', v_register.id,
    'name', v_register.name,
    'code', v_register.code,
    'is_active', v_register.is_active
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manage_cash_register(uuid, text, uuid, text, text, boolean) TO authenticated;
