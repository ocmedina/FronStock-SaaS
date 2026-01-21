-- =====================================================
-- FrontStock SaaS - Políticas RLS para Organizations
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 0. Eliminar políticas existentes (si existen)
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organization" ON organizations;

-- 1. Habilitar Row Level Security en la tabla organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 2. Política SELECT: Los usuarios pueden ver su propia organización
-- También permite ver la org recién creada (antes de actualizar profile)
CREATE POLICY "organizations_select" ON organizations FOR SELECT TO authenticated
  USING (
    id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR 
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id IS NOT NULL)
  );

-- 3. Política INSERT: Los usuarios autenticados pueden crear organizaciones
-- Solo si aún no tienen una organización asignada
CREATE POLICY "organizations_insert" ON organizations FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
  );

-- 4. Política UPDATE: Solo pueden actualizar la organización a la que pertenecen
CREATE POLICY "organizations_update" ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 5. Política DELETE: Solo el owner puede eliminar la organización
CREATE POLICY "organizations_delete" ON organizations FOR DELETE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- =====================================================
-- IMPORTANTE: Ejecuta este SQL en Supabase SQL Editor
-- =====================================================
-- Si sigue dando error, ejecuta esto para verificar las políticas:
-- SELECT * FROM pg_policies WHERE tablename = 'organizations';
--
-- O temporalmente deshabilita RLS para probar:
-- ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
