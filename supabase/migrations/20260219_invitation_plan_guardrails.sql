-- =============================================================================
-- Invitation + Plan seats guardrails
-- Regla de cupos: usuarios activos + invitaciones pendientes
-- =============================================================================

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

CREATE OR REPLACE FUNCTION get_plan_max_users(p_plan_type text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE lower(coalesce(p_plan_type, 'free'))
    WHEN 'free' THEN 1
    WHEN 'entrepreneur' THEN 2
    WHEN 'business' THEN 10
    WHEN 'enterprise' THEN NULL
    ELSE 1
  END;
END;
$$;

CREATE OR REPLACE FUNCTION can_add_user_seat(
  p_org_id uuid,
  p_excluded_invitation_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_type text;
  v_max_users integer;
  v_users_count integer := 0;
  v_pending_count integer := 0;
BEGIN
  SELECT plan_type
    INTO v_plan_type
  FROM organizations
  WHERE id = p_org_id
  LIMIT 1;

  v_max_users := get_plan_max_users(v_plan_type);

  IF v_max_users IS NULL THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
    INTO v_users_count
  FROM profiles
  WHERE organization_id = p_org_id;

  SELECT COUNT(*)
    INTO v_pending_count
  FROM invitations
  WHERE organization_id = p_org_id
    AND status = 'pending'
    AND (p_excluded_invitation_id IS NULL OR id <> p_excluded_invitation_id);

  RETURN (v_users_count + v_pending_count) < v_max_users;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_invitation_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    IF TG_OP = 'INSERT' THEN
      IF NOT can_add_user_seat(NEW.organization_id, NULL) THEN
        RAISE EXCEPTION 'Plan user limit reached for invitations';
      END IF;
    ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM 'pending' OR OLD.organization_id IS DISTINCT FROM NEW.organization_id) THEN
      IF NOT can_add_user_seat(NEW.organization_id, OLD.id) THEN
        RAISE EXCEPTION 'Plan user limit reached for invitations';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invitation_plan_limit ON invitations;
CREATE TRIGGER trg_enforce_invitation_plan_limit
BEFORE INSERT OR UPDATE ON invitations
FOR EACH ROW
EXECUTE FUNCTION enforce_invitation_plan_limit();

CREATE OR REPLACE FUNCTION accept_invitation_with_plan_check(
  p_token text,
  p_user_id uuid,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_user_email text;
BEGIN
  SELECT *
    INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitación inválida o ya utilizada');
  END IF;

  IF v_invitation.expires_at <= now() THEN
    UPDATE invitations
      SET status = 'expired'
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object('success', false, 'error', 'La invitación expiró');
  END IF;

  SELECT email
    INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id
  LIMIT 1;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario autenticado inválido');
  END IF;

  IF lower(v_user_email) <> lower(v_invitation.email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El email del usuario no coincide con la invitación');
  END IF;

  IF NOT can_add_user_seat(v_invitation.organization_id, v_invitation.id) THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'No hay cupos disponibles en el plan actual para aceptar esta invitación. Libera un cupo o actualiza el plan.'
    );
  END IF;

  INSERT INTO profiles (id, full_name, organization_id, role, updated_at)
  VALUES (
    p_user_id,
    COALESCE(p_full_name, split_part(v_user_email, '@', 1)),
    v_invitation.organization_id,
    v_invitation.role,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    organization_id = EXCLUDED.organization_id,
    role = EXCLUDED.role,
    updated_at = now();

  UPDATE invitations
    SET status = 'accepted'
  WHERE id = v_invitation.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'La invitación ya fue procesada');
  END IF;

  RETURN jsonb_build_object('success', true, 'organization_id', v_invitation.organization_id, 'role', v_invitation.role);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation_with_plan_check(text, uuid, text) TO authenticated;
