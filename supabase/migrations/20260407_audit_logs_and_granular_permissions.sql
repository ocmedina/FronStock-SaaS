-- =============================================================================
-- Audit logs + new granular permissions (sales price override, audit view)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'custom')),
  entity text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_at
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  VALUES (
    p_org_id,
    p_actor_user_id,
    p_action,
    p_entity,
    p_entity_id,
    p_before,
    p_after,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb, jsonb, jsonb, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_org_id uuid;
  v_entity_id text;
  v_actor_text text;
  v_actor_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
    v_before := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_after := to_jsonb(NEW);
    v_before := to_jsonb(OLD);
  ELSE
    v_after := NULL;
    v_before := to_jsonb(OLD);
  END IF;

  v_org_id := COALESCE(
    NULLIF(COALESCE(v_after, '{}'::jsonb)->>'organization_id', '')::uuid,
    NULLIF(COALESCE(v_before, '{}'::jsonb)->>'organization_id', '')::uuid
  );

  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_entity_id := COALESCE(
    COALESCE(v_after, '{}'::jsonb)->>'id',
    COALESCE(v_before, '{}'::jsonb)->>'id'
  );

  IF v_entity_id IS NULL AND TG_TABLE_NAME = 'organization_permissions' THEN
    v_entity_id := COALESCE(v_after->>'role', v_before->>'role', 'unknown') || ':' || COALESCE(v_after->>'module', v_before->>'module', 'unknown');
  END IF;

  v_actor_text := COALESCE(
    COALESCE(v_after, '{}'::jsonb)->>'created_by',
    COALESCE(v_before, '{}'::jsonb)->>'created_by'
  );

  IF auth.uid() IS NOT NULL THEN
    v_actor_user_id := auth.uid();
  ELSIF v_actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_actor_user_id := v_actor_text::uuid;
  ELSE
    v_actor_user_id := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  VALUES (
    v_org_id,
    v_actor_user_id,
    LOWER(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    jsonb_build_object('source', 'trigger')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();

DROP TRIGGER IF EXISTS trg_audit_sales ON public.sales;
CREATE TRIGGER trg_audit_sales
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();

DROP TRIGGER IF EXISTS trg_audit_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_audit_stock_movements
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();

DROP TRIGGER IF EXISTS trg_audit_org_permissions ON public.organization_permissions;
CREATE TRIGGER trg_audit_org_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.organization_permissions
FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();

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
        'products:cost_price', 'products:import', 'products:export', 'sales:view_all', 'sales:view_metrics',
        'sales:override_price'
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
      WHEN r.role = 'billing' AND m.module IN ('dashboard', 'invoices') THEN true
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
      WHEN r.role = 'billing' AND m.module = 'invoices' THEN true
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
      WHEN r.role = 'billing' AND m.module = 'invoices' THEN true
      ELSE false
    END AS can_edit,
    CASE
      WHEN r.role = 'owner' THEN true
      WHEN r.role = 'admin' AND m.module NOT IN ('settings', 'users', 'permissions') THEN true
      ELSE false
    END AS can_delete
  FROM
    (VALUES ('owner'), ('admin'), ('manager'), ('employee'), ('delivery'), ('billing'), ('viewer')) AS r(role)
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
        ('sales:override_price'),
        ('audit:view'),
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
