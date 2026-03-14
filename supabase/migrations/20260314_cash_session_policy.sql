-- Configuracion de politica de caja por organizacion
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS cash_session_policy text NOT NULL DEFAULT 'cash_only';

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS cash_session_scope text NOT NULL DEFAULT 'all_users';

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS cash_session_assigned_user_ids uuid[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_cash_session_policy_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_cash_session_policy_check
      CHECK (cash_session_policy IN ('always', 'cash_only', 'off'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_cash_session_scope_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_cash_session_scope_check
      CHECK (cash_session_scope IN ('all_users', 'assigned_users'));
  END IF;
END $$;

COMMENT ON COLUMN organizations.cash_session_policy IS
  'Politica de caja: always (siempre), cash_only (solo si hay efectivo), off (nunca)';

COMMENT ON COLUMN organizations.cash_session_scope IS
  'Alcance de la politica: all_users o assigned_users';

COMMENT ON COLUMN organizations.cash_session_assigned_user_ids IS
  'Usuarios alcanzados cuando cash_session_scope = assigned_users';
