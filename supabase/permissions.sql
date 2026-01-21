-- =====================================================
-- FrontStock SaaS - Sistema de Permisos Dinámicos
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Tabla de configuración de permisos por organización
CREATE TABLE IF NOT EXISTS organization_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,  -- owner, admin, manager, employee, viewer, o roles custom
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, role, module)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_org_permissions ON organization_permissions(organization_id, role);

-- Habilitar RLS
ALTER TABLE organization_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para organization_permissions
CREATE POLICY "org_permissions_select" ON organization_permissions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_permissions_insert" ON organization_permissions FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_permissions_update" ON organization_permissions FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_permissions_delete" ON organization_permissions FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );
