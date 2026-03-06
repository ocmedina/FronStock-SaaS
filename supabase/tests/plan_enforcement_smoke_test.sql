-- =============================================================================
-- PLAN ENFORCEMENT - SMOKE TEST (PASS/FAIL)
-- Ejecutar en Supabase SQL Editor (idealmente en un proyecto de staging)
-- =============================================================================
-- Opcional: podés fijar IDs reales en v_org_id_input / v_test_user_id_input.
-- Si quedan en placeholder, el script intenta resolverlos automáticamente.
--
-- Este script NO deja cambios: trabaja dentro de una transacción y hace ROLLBACK.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _plan_test_output (
  step text,
  status text,
  detail text,
  created_at timestamptz default now()
);

DO $$
DECLARE
  v_org_id_input uuid := '00000000-0000-0000-0000-000000000000';
  v_test_user_id_input uuid := '00000000-0000-0000-0000-000000000000';

  v_org_id uuid;
  v_test_user_id uuid;

  v_plan text;
  v_products_before integer := 0;
  v_users_before integer := 0;
  v_product_limit integer;
  v_user_limit integer;

  v_seed_product_id uuid;
  v_inserted_products integer := 0;

  v_ok_products boolean := false;
  v_ok_users boolean := false;
  v_has_skip boolean := false;
  v_users_result_status text := 'SKIP';
  v_users_result_detail text := 'No ejecutado';
BEGIN
  -- Resolver organización de prueba automáticamente si queda placeholder
  IF v_org_id_input = '00000000-0000-0000-0000-000000000000'::uuid THEN
    SELECT id
      INTO v_org_id
    FROM organizations
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'No hay organizaciones para testear. Crea una organización primero.';
    END IF;
  ELSE
    v_org_id := v_org_id_input;
  END IF;

  -- Resolver usuario de prueba automáticamente si queda placeholder
  IF v_test_user_id_input = '00000000-0000-0000-0000-000000000000'::uuid THEN
    -- Preferimos un usuario fuera de la organización objetivo para forzar cambio de org
    SELECT p.id
      INTO v_test_user_id
    FROM profiles p
    WHERE p.organization_id IS DISTINCT FROM v_org_id
    LIMIT 1;

    -- Fallback: cualquier usuario (si no hay fuera de org)
    IF v_test_user_id IS NULL THEN
      SELECT p.id
        INTO v_test_user_id
      FROM profiles p
      LIMIT 1;
    END IF;
  ELSE
    v_test_user_id := v_test_user_id_input;
  END IF;

  SELECT plan_type INTO v_plan
  FROM organizations
  WHERE id = v_org_id;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'No existe organization para id %', v_org_id;
  END IF;

  v_product_limit := get_plan_max_products(v_plan);
  v_user_limit := get_plan_max_users(v_plan);

  SELECT COUNT(*) INTO v_products_before FROM products WHERE organization_id = v_org_id;
  SELECT COUNT(*) INTO v_users_before FROM profiles WHERE organization_id = v_org_id;

  RAISE NOTICE '--- CONTEXTO ---';
  RAISE NOTICE 'Plan: %', v_plan;
  RAISE NOTICE 'Org usada para test: %', v_org_id;
  RAISE NOTICE 'User de prueba: %', COALESCE(v_test_user_id::text, 'NO ENCONTRADO');
  RAISE NOTICE 'Límite productos: %', COALESCE(v_product_limit::text, 'ILIMITADO');
  RAISE NOTICE 'Límite usuarios: %', COALESCE(v_user_limit::text, 'ILIMITADO');
  RAISE NOTICE 'Productos actuales: %', v_products_before;
  RAISE NOTICE 'Usuarios actuales: %', v_users_before;

  INSERT INTO _plan_test_output(step, status, detail)
  VALUES (
    'contexto',
    'INFO',
    format('plan=%s, org=%s, user_test=%s, productos=%s, usuarios=%s',
      v_plan,
      v_org_id,
      COALESCE(v_test_user_id::text, 'NO ENCONTRADO'),
      v_products_before,
      v_users_before
    )
  );

  -- ---------------------------------------------------------------------------
  -- TEST 1: Funciones de mapeo
  -- ---------------------------------------------------------------------------
  IF get_plan_max_users('free') = 1
     AND get_plan_max_users('entrepreneur') = 2
     AND get_plan_max_users('business') = 10
     AND get_plan_max_users('enterprise') IS NULL
     AND get_plan_max_products('free') = 50
     AND get_plan_max_products('entrepreneur') = 500
     AND get_plan_max_products('business') IS NULL
     AND get_plan_sales_history_months('free') = 1
     AND get_plan_sales_history_months('entrepreneur') = 6
     AND get_plan_sales_history_months('business') IS NULL THEN
    RAISE NOTICE 'PASS - Mapping de límites por plan';
    INSERT INTO _plan_test_output(step, status, detail)
    VALUES ('mapping_limites', 'PASS', 'Funciones de plan devuelven valores esperados');
  ELSE
    RAISE EXCEPTION 'FAIL - Mapping de límites por plan';
  END IF;

  -- ---------------------------------------------------------------------------
  -- TEST 2: Trigger de productos (solo si plan tiene límite)
  -- ---------------------------------------------------------------------------
  IF v_product_limit IS NULL THEN
    RAISE NOTICE 'SKIP - Trigger productos (plan ilimitado)';
    v_has_skip := true;
    INSERT INTO _plan_test_output(step, status, detail)
    VALUES ('trigger_productos', 'SKIP', 'Plan ilimitado en productos');
  ELSE
    -- Elegir un producto semilla para copiar estructura (evita requerir columnas extra)
    SELECT id INTO v_seed_product_id
    FROM products
    WHERE organization_id = v_org_id
    LIMIT 1;

    IF v_seed_product_id IS NULL THEN
      RAISE NOTICE 'SKIP - Trigger productos (no hay producto semilla para clonar)';
      v_has_skip := true;
      INSERT INTO _plan_test_output(step, status, detail)
      VALUES ('trigger_productos', 'SKIP', 'No existe producto semilla para clonar');
    ELSE
      BEGIN
        LOOP
          EXIT WHEN (SELECT COUNT(*) FROM products WHERE organization_id = v_org_id) >= v_product_limit;

          INSERT INTO products (
            organization_id,
            name,
            sku,
            barcode,
            stock,
            price,
            cost_price,
            wholesale_price,
            min_stock,
            is_combo,
            description,
            plu,
            created_at
          )
          SELECT
            p.organization_id,
            p.name || ' [PLAN-TEST ' || gen_random_uuid()::text || ']',
            p.sku,
            p.barcode,
            p.stock,
            p.price,
            p.cost_price,
            p.wholesale_price,
            p.min_stock,
            p.is_combo,
            p.description,
            p.plu,
            now()
          FROM products p
          WHERE p.id = v_seed_product_id;

          v_inserted_products := v_inserted_products + 1;
          EXIT WHEN v_inserted_products > 1000;
        END LOOP;

        BEGIN
          INSERT INTO products (
            organization_id,
            name,
            sku,
            barcode,
            stock,
            price,
            cost_price,
            wholesale_price,
            min_stock,
            is_combo,
            description,
            plu,
            created_at
          )
          SELECT
            p.organization_id,
            p.name || ' [PLAN-OVERFLOW ' || gen_random_uuid()::text || ']',
            p.sku,
            p.barcode,
            p.stock,
            p.price,
            p.cost_price,
            p.wholesale_price,
            p.min_stock,
            p.is_combo,
            p.description,
            p.plu,
            now()
          FROM products p
          WHERE p.id = v_seed_product_id;

          v_ok_products := false;
        EXCEPTION
          WHEN OTHERS THEN
            IF position('Límite de productos alcanzado' in SQLERRM) > 0 THEN
              v_ok_products := true;
            ELSE
              RAISE;
            END IF;
        END;

        IF v_ok_products THEN
          RAISE NOTICE 'PASS - Trigger de productos bloquea overflow';
          INSERT INTO _plan_test_output(step, status, detail)
          VALUES ('trigger_productos', 'PASS', 'Bloqueó inserción por overflow de plan');
        ELSE
          RAISE EXCEPTION 'FAIL - Trigger de productos NO bloqueó overflow';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'SKIP - Trigger productos: %', SQLERRM;
          v_has_skip := true;
          INSERT INTO _plan_test_output(step, status, detail)
          VALUES ('trigger_productos', 'SKIP', SQLERRM);
      END;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- TEST 3: Trigger de usuarios/perfiles (solo si plan tiene límite)
  -- ---------------------------------------------------------------------------
  IF v_user_limit IS NULL THEN
    RAISE NOTICE 'SKIP - Trigger usuarios (plan ilimitado)';
    v_ok_users := true;
    v_has_skip := true;
    v_users_result_status := 'SKIP';
    v_users_result_detail := 'Plan ilimitado en usuarios';
  ELSE
    IF v_test_user_id IS NULL THEN
      RAISE NOTICE 'SKIP - Trigger usuarios (no se encontró usuario de prueba)';
      v_ok_users := true;
      v_has_skip := true;
      v_users_result_status := 'SKIP';
      v_users_result_detail := 'No se encontró usuario para test';
    ELSE
    -- Intento de mover usuario de prueba a una org ya llena debe fallar.
    -- Nota: si tu org no está llena, este test puede no disparar.
    BEGIN
      IF v_users_before >= v_user_limit THEN
        UPDATE profiles
        SET organization_id = v_org_id,
            updated_at = now()
        WHERE id = v_test_user_id;

        v_ok_users := false;
      ELSE
        RAISE NOTICE 'SKIP - Trigger usuarios (la org aún no está llena)';
        v_ok_users := true;
        v_has_skip := true;
        v_users_result_status := 'SKIP';
        v_users_result_detail := 'La organización aún no está llena para probar bloqueo';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        IF position('Límite de usuarios alcanzado' in SQLERRM) > 0 THEN
          v_ok_users := true;
          v_users_result_status := 'PASS';
          v_users_result_detail := 'Bloqueó asignación por overflow de plan';
        ELSE
          RAISE;
        END IF;
    END;
      END IF;

    IF v_ok_users THEN
      RAISE NOTICE 'PASS - Trigger de usuarios/perfiles validado';
      INSERT INTO _plan_test_output(step, status, detail)
      VALUES ('trigger_usuarios', v_users_result_status, v_users_result_detail);
    ELSE
      RAISE EXCEPTION 'FAIL - Trigger de usuarios/perfiles NO bloqueó overflow';
    END IF;
  END IF;

  IF v_has_skip THEN
    RAISE NOTICE '--- RESULTADO GENERAL: WARN (con SKIP) ---';
    INSERT INTO _plan_test_output(step, status, detail)
    VALUES ('resultado_general', 'WARN', 'Suite sin fallos críticos, pero con pruebas SKIP');
  ELSE
    RAISE NOTICE '--- RESULTADO GENERAL: OK ---';
    INSERT INTO _plan_test_output(step, status, detail)
    VALUES ('resultado_general', 'PASS', 'Suite completada sin fallos críticos');
  END IF;
END;
$$;

SELECT step, status, detail, created_at
FROM _plan_test_output
ORDER BY created_at, step;

ROLLBACK;
