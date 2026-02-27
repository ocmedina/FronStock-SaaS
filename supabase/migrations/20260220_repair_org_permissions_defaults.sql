-- =============================================================================
-- Repair organization_permissions defaults (roles/modules matrix backfill)
-- =============================================================================

-- 1) Ensure table exists with expected unique key
CREATE TABLE IF NOT EXISTS organization_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, role, module)
);

CREATE INDEX IF NOT EXISTS idx_org_permissions_org_role_module
  ON organization_permissions(organization_id, role, module);

-- 2) Helper function: insert any missing role/module permissions for one organization
CREATE OR REPLACE FUNCTION ensure_org_permissions_defaults(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO organization_permissions (
    organization_id,
    role,
    module,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
  SELECT
    p_org_id,
    r.role,
    m.module,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'manager' AND m.module IN ('dashboard', 'products', 'categories', 'customers', 'sales', 'reports', 'users', 'products:cost_price', 'products:import', 'products:export', 'sales:view_all', 'sales:view_metrics') THEN true
      WHEN r.role = 'employee' AND m.module IN ('dashboard', 'products', 'categories', 'customers', 'sales') THEN true
      WHEN r.role = 'delivery' AND m.module IN ('dashboard', 'customers', 'sales') THEN true
      WHEN r.role = 'viewer' AND m.module IN ('dashboard', 'products', 'categories', 'customers', 'sales', 'reports', 'products:cost_price', 'sales:view_all', 'sales:view_metrics') THEN true
      ELSE false
    END AS can_view,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'manager' AND m.module IN ('products', 'categories', 'customers', 'sales') THEN true
      WHEN r.role = 'employee' AND m.module IN ('customers', 'sales') THEN true
      ELSE false
    END AS can_create,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'manager' AND m.module IN ('products', 'categories', 'customers', 'sales') THEN true
      WHEN r.role = 'delivery' AND m.module = 'sales' THEN true
      ELSE false
    END AS can_edit,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' AND m.module NOT IN ('settings', 'users', 'permissions') THEN true
      ELSE false
    END AS can_delete
  FROM
    (VALUES ('owner'), ('admin'), ('manager'), ('employee'), ('delivery'), ('viewer')) AS r(role)
  CROSS JOIN
    (
      VALUES
        ('dashboard'),
        ('products'),
        ('categories'),
        ('customers'),
        ('sales'),
        ('reports'),
        ('settings'),
        ('users'),
        ('permissions'),
        ('products:cost_price'),
        ('products:import'),
        ('products:export'),
        ('sales:view_all'),
        ('sales:view_metrics'),
        ('users:manage_roles')
    ) AS m(module)
  ON CONFLICT (organization_id, role, module) DO NOTHING;
END;
$$;

-- 3) Backfill all existing organizations
DO $$
DECLARE
  v_org uuid;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    PERFORM ensure_org_permissions_defaults(v_org);
  END LOOP;
END;
$$;

-- 4) Auto-backfill on new organizations
CREATE OR REPLACE FUNCTION trg_fill_org_permissions_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM ensure_org_permissions_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_fill_permissions_defaults ON organizations;
CREATE TRIGGER trg_organizations_fill_permissions_defaults
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION trg_fill_org_permissions_defaults();
