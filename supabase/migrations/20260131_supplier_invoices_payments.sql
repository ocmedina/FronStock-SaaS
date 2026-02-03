-- Migration: Create supplier_invoices table
-- Description: Table to store invoices received from suppliers

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  other_taxes DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  
  file_url TEXT, -- URL del PDF de la factura
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_org ON supplier_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(payment_status);

-- RLS Policies
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view supplier invoices from their organization" ON supplier_invoices;
CREATE POLICY "Users can view supplier invoices from their organization"
  ON supplier_invoices FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert supplier invoices to their organization" ON supplier_invoices;
CREATE POLICY "Users can insert supplier invoices to their organization"
  ON supplier_invoices FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update supplier invoices from their organization" ON supplier_invoices;
CREATE POLICY "Users can update supplier invoices from their organization"
  ON supplier_invoices FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete supplier invoices from their organization" ON supplier_invoices;
CREATE POLICY "Users can delete supplier invoices from their organization"
  ON supplier_invoices FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Create supplier_payments table
CREATE TABLE IF NOT EXISTS supplier_invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50), -- cash, transfer, check, card
  reference VARCHAR(100), -- número de cheque, transferencia, etc.
  
  receipt_url TEXT, -- URL del comprobante
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_org ON supplier_invoice_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_invoice_payments(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_invoice_payments(supplier_id);

-- RLS Policies
ALTER TABLE supplier_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view supplier payments from their organization" ON supplier_invoice_payments;
CREATE POLICY "Users can view supplier payments from their organization"
  ON supplier_invoice_payments FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert supplier payments to their organization" ON supplier_invoice_payments;
CREATE POLICY "Users can insert supplier payments to their organization"
  ON supplier_invoice_payments FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update supplier payments from their organization" ON supplier_invoice_payments;
CREATE POLICY "Users can update supplier payments from their organization"
  ON supplier_invoice_payments FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Function to update supplier invoice paid amount and status
CREATE OR REPLACE FUNCTION update_supplier_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_invoices
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM supplier_invoice_payments
      WHERE supplier_invoice_id = NEW.supplier_invoice_id
    ),
    payment_status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM supplier_invoice_payments WHERE supplier_invoice_id = NEW.supplier_invoice_id) >= total THEN 'paid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM supplier_invoice_payments WHERE supplier_invoice_id = NEW.supplier_invoice_id) > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.supplier_invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update payment status
DROP TRIGGER IF EXISTS trigger_update_supplier_invoice_payment_status ON supplier_invoice_payments;
CREATE TRIGGER trigger_update_supplier_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON supplier_invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_invoice_payment_status();
