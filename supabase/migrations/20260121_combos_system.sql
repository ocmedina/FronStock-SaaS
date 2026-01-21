-- =============================================================================
-- MIGRACIÓN: Sistema de Combos y Promociones
-- =============================================================================

-- 1. Agregar flag is_combo a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_combo boolean DEFAULT false;

-- 2. Crear tabla de relación para componentes del combo
CREATE TABLE IF NOT EXISTS product_combos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    parent_product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    child_product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    
    -- Evitar duplicados del mismo producto en un combo (opcional, pero buena práctica)
    UNIQUE(parent_product_id, child_product_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_combos_parent ON product_combos(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_combos_child ON product_combos(child_product_id);

-- 4. Actualizar Policies (RLS)
ALTER TABLE product_combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in same organization" ON product_combos
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Enable insert for users in same organization" ON product_combos
    FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Enable update for users in same organization" ON product_combos
    FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Enable delete for users in same organization" ON product_combos
    FOR DELETE
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));
