-- =====================================================
-- User Security Preferences (per user + organization)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_security_preferences (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_timeout_minutes integer NOT NULL DEFAULT 60,
  notify_new_device boolean NOT NULL DEFAULT false,
  access_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_security_preferences_org
  ON user_security_preferences (organization_id);

ALTER TABLE user_security_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_security_preferences_select_own" ON user_security_preferences;
CREATE POLICY "user_security_preferences_select_own"
  ON user_security_preferences FOR SELECT
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_security_preferences_insert_own" ON user_security_preferences;
CREATE POLICY "user_security_preferences_insert_own"
  ON user_security_preferences FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_security_preferences_update_own" ON user_security_preferences;
CREATE POLICY "user_security_preferences_update_own"
  ON user_security_preferences FOR UPDATE
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_security_preferences_delete_own" ON user_security_preferences;
CREATE POLICY "user_security_preferences_delete_own"
  ON user_security_preferences FOR DELETE
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_user_security_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_security_preferences_updated_at ON user_security_preferences;
CREATE TRIGGER trg_user_security_preferences_updated_at
  BEFORE UPDATE ON user_security_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_user_security_preferences_updated_at();
