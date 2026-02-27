-- =============================================================================
-- Expand organization_permissions modules matrix (stock/suppliers/purchases/etc)
-- =============================================================================

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
      WHEN r.role = 'manager' AND m.module IN (
        'dashboard', 'products', 'stock', 'categories', 'customers', 'suppliers', 'purchases',
        'sales', 'invoices', 'promotions', 'orders', 'delivery', 'reports', 'users',
        'products:cost_price', 'products:import', 'products:export', 'sales:view_all', 'sales:view_metrics'
      ) THEN true
      WHEN r.role = 'employee' AND m.module IN (
        'dashboard', 'products', 'stock', 'categories', 'customers', 'suppliers', 'purchases',
        'sales', 'invoices', 'promotions', 'orders', 'delivery'
      ) THEN true
      WHEN r.role = 'delivery' AND m.module IN (
        'dashboard', 'customers', 'sales', 'invoices', 'promotions', 'orders', 'delivery'
      ) THEN true
      WHEN r.role = 'viewer' AND m.module IN (
        'dashboard', 'products', 'stock', 'categories', 'customers', 'suppliers', 'purchases',
        'sales', 'invoices', 'promotions', 'orders', 'delivery', 'reports',
        'products:cost_price', 'sales:view_all', 'sales:view_metrics'
      ) THEN true
      ELSE false
    END AS can_view,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'manager' AND m.module IN (
        'products', 'stock', 'categories', 'customers', 'suppliers', 'purchases',
        'sales', 'invoices', 'promotions', 'orders', 'delivery'
      ) THEN true
      WHEN r.role = 'employee' AND m.module IN (
        'customers', 'sales', 'invoices', 'promotions', 'orders', 'delivery'
      ) THEN true
      ELSE false
    END AS can_create,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'manager' AND m.module IN (
        'products', 'stock', 'categories', 'customers', 'suppliers', 'purchases',
        'sales', 'invoices', 'promotions', 'orders', 'delivery'
      ) THEN true
      WHEN r.role = 'delivery' AND m.module IN ('sales', 'invoices', 'promotions', 'orders', 'delivery') THEN true
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
        ('stock'),
        ('categories'),
        ('customers'),
        ('suppliers'),
        ('purchases'),
        ('sales'),
        ('invoices'),
        ('promotions'),
        ('orders'),
        ('delivery'),
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

DO $$
DECLARE
  v_org uuid;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    PERFORM ensure_org_permissions_defaults(v_org);
  END LOOP;
END;
$$;
