-- =====================================================
-- FrontStock SaaS - Movimientos de Stock
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Tabla de Movimientos de Stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL,
  movement_type TEXT NOT NULL, -- entry, exit, adjustment
  quantity INT NOT NULL, -- positive for entry, negative for exit
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason TEXT, -- sale, purchase, adjustment, damaged, lost, returned, correction
  reference_type TEXT, -- sale, purchase_order, manual
  reference_id UUID, -- ID of sale or purchase order if applicable
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- Habilitar RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas para stock_movements
CREATE POLICY "stock_movements_all" ON stock_movements FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
