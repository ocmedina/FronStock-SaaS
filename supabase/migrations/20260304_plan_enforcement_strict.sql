-- =============================================================================
-- MIGRACIÓN: ENFORCEMENT ESTRICTO DE LÍMITES POR PLAN
-- Fecha: 2026-03-04
-- =============================================================================

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

CREATE OR REPLACE FUNCTION get_plan_max_products(p_plan_type text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE lower(coalesce(p_plan_type, 'free'))
    WHEN 'free' THEN 50
    WHEN 'entrepreneur' THEN 500
    WHEN 'business' THEN NULL
    WHEN 'enterprise' THEN NULL
    ELSE 50
  END;
END;
$$;

CREATE OR REPLACE FUNCTION get_plan_sales_history_months(p_plan_type text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE lower(coalesce(p_plan_type, 'free'))
    WHEN 'free' THEN 1
    WHEN 'entrepreneur' THEN 6
    WHEN 'business' THEN NULL
    WHEN 'enterprise' THEN NULL
    ELSE 1
  END;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_profiles_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_type text;
  v_max_users integer;
  v_users_count integer := 0;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;

  SELECT plan_type
    INTO v_plan_type
  FROM organizations
  WHERE id = NEW.organization_id
  LIMIT 1;

  v_max_users := get_plan_max_users(v_plan_type);

  IF v_max_users IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_users_count
  FROM profiles
  WHERE organization_id = NEW.organization_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_users_count >= v_max_users THEN
    RAISE EXCEPTION 'Límite de usuarios alcanzado para el plan actual';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profiles_plan_limit ON profiles;
CREATE TRIGGER trg_enforce_profiles_plan_limit
BEFORE INSERT OR UPDATE OF organization_id ON profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_profiles_plan_limit();

CREATE OR REPLACE FUNCTION enforce_products_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_type text;
  v_max_products integer;
  v_products_count integer := 0;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;

  SELECT plan_type
    INTO v_plan_type
  FROM organizations
  WHERE id = NEW.organization_id
  LIMIT 1;

  v_max_products := get_plan_max_products(v_plan_type);

  IF v_max_products IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_products_count
  FROM products
  WHERE organization_id = NEW.organization_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_products_count >= v_max_products THEN
    RAISE EXCEPTION 'Límite de productos alcanzado para el plan actual';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_products_plan_limit ON products;
CREATE TRIGGER trg_enforce_products_plan_limit
BEFORE INSERT OR UPDATE OF organization_id ON products
FOR EACH ROW
EXECUTE FUNCTION enforce_products_plan_limit();
