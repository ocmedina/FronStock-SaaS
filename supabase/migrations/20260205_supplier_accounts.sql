-- =====================================================
-- Migración: Sistema de Cuenta Corriente de Proveedores
-- Fecha: 2026-02-05
-- Descripción: Agrega gestión financiera completa para proveedores
-- =====================================================

-- 1. Actualizar tabla suppliers con campos financieros
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS early_payment_discount DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_date DATE,
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5);

COMMENT ON COLUMN suppliers.credit_limit IS 'Límite de crédito otorgado al proveedor';
COMMENT ON COLUMN suppliers.payment_terms IS 'Días de crédito (30, 60, 90)';
COMMENT ON COLUMN suppliers.early_payment_discount IS 'Descuento por pronto pago (%)';
COMMENT ON COLUMN suppliers.current_balance IS 'Balance actual (negativo = debemos, positivo = nos deben)';
COMMENT ON COLUMN suppliers.rating IS 'Calificación del proveedor (1-5 estrellas)';

-- 2. Tabla de pagos a proveedores
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE supplier_payments IS 'Registro de pagos realizados a proveedores';

-- Índices para supplier_payments
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_org ON supplier_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_po ON supplier_payments(purchase_order_id);

-- 3. Tabla de transacciones de cuenta corriente
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'payment', 'credit_note', 'debit_note', 'adjustment')),
  reference_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE supplier_transactions IS 'Historial de movimientos en cuenta corriente de proveedores';
COMMENT ON COLUMN supplier_transactions.transaction_type IS 'Tipo: purchase (compra), payment (pago), credit_note (nota de crédito), debit_note (nota de débito), adjustment (ajuste)';

-- Índices para supplier_transactions
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier ON supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_org ON supplier_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_date ON supplier_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions(transaction_type);

-- 4. RLS Policies para supplier_payments
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments from their organization"
  ON supplier_payments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create payments in their organization"
  ON supplier_payments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update payments in their organization"
  ON supplier_payments FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5. RLS Policies para supplier_transactions
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions from their organization"
  ON supplier_transactions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can create transactions"
  ON supplier_transactions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 6. Función para registrar un pago a proveedor
CREATE OR REPLACE FUNCTION register_supplier_payment(
  p_organization_id UUID,
  p_supplier_id UUID,
  p_purchase_order_id UUID,
  p_amount DECIMAL,
  p_payment_method VARCHAR,
  p_payment_date DATE,
  p_reference_number VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Validar que el proveedor existe
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND organization_id = p_organization_id) THEN
    RETURN json_build_object('success', false, 'error', 'Proveedor no encontrado');
  END IF;

  -- Obtener balance actual
  SELECT current_balance INTO v_current_balance
  FROM suppliers
  WHERE id = p_supplier_id;

  -- Calcular nuevo balance (restar el pago)
  v_new_balance := v_current_balance - p_amount;

  -- Insertar el pago
  INSERT INTO supplier_payments (
    organization_id,
    supplier_id,
    purchase_order_id,
    amount,
    payment_method,
    payment_date,
    reference_number,
    notes,
    created_by
  ) VALUES (
    p_organization_id,
    p_supplier_id,
    p_purchase_order_id,
    p_amount,
    p_payment_method,
    p_payment_date,
    p_reference_number,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- Registrar transacción
  INSERT INTO supplier_transactions (
    organization_id,
    supplier_id,
    transaction_type,
    reference_id,
    amount,
    balance_after,
    description,
    transaction_date
  ) VALUES (
    p_organization_id,
    p_supplier_id,
    'payment',
    v_payment_id,
    -p_amount, -- Negativo porque es un pago (reduce la deuda)
    v_new_balance,
    'Pago registrado - ' || p_payment_method || COALESCE(' - Ref: ' || p_reference_number, ''),
    p_payment_date
  );

  -- Actualizar balance del proveedor
  UPDATE suppliers
  SET 
    current_balance = v_new_balance,
    last_payment_date = p_payment_date,
    updated_at = NOW()
  WHERE id = p_supplier_id;

  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'new_balance', v_new_balance
  );
END;
$$;

-- 7. Función para obtener estado de cuenta de proveedor
CREATE OR REPLACE FUNCTION get_supplier_account_statement(
  p_supplier_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  transaction_type VARCHAR,
  description TEXT,
  debit DECIMAL,
  credit DECIMAL,
  balance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.transaction_date,
    st.transaction_type,
    st.description,
    CASE WHEN st.amount > 0 THEN st.amount ELSE 0 END as debit,
    CASE WHEN st.amount < 0 THEN ABS(st.amount) ELSE 0 END as credit,
    st.balance_after
  FROM supplier_transactions st
  WHERE st.supplier_id = p_supplier_id
    AND (p_start_date IS NULL OR st.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR st.transaction_date <= p_end_date)
  ORDER BY st.transaction_date DESC, st.created_at DESC;
END;
$$;

-- 8. Trigger para actualizar balance al recibir una orden de compra
CREATE OR REPLACE FUNCTION update_supplier_balance_on_receive()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Solo ejecutar cuando el estado cambia a 'received'
  IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
    -- Obtener balance actual
    SELECT current_balance INTO v_current_balance
    FROM suppliers
    WHERE id = NEW.supplier_id;

    -- Calcular nuevo balance (sumar la compra)
    v_new_balance := v_current_balance + NEW.total;

    -- Actualizar balance del proveedor
    UPDATE suppliers
    SET current_balance = v_new_balance
    WHERE id = NEW.supplier_id;

    -- Registrar transacción
    INSERT INTO supplier_transactions (
      organization_id,
      supplier_id,
      transaction_type,
      reference_id,
      amount,
      balance_after,
      description,
      transaction_date
    ) VALUES (
      NEW.organization_id,
      NEW.supplier_id,
      'purchase',
      NEW.id,
      NEW.total,
      v_new_balance,
      'Orden de compra #' || COALESCE(NEW.order_number, NEW.id::TEXT) || ' recibida',
      COALESCE(NEW.received_at::DATE, CURRENT_DATE)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_update_supplier_balance ON purchase_orders;
CREATE TRIGGER trigger_update_supplier_balance
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_balance_on_receive();

-- 9. Vista para resumen de proveedores
CREATE OR REPLACE VIEW supplier_summary AS
SELECT 
  s.id,
  s.organization_id,
  s.name,
  s.current_balance,
  s.credit_limit,
  s.payment_terms,
  s.rating,
  s.last_payment_date,
  (s.credit_limit - s.current_balance) as available_credit,
  COUNT(DISTINCT po.id) FILTER (WHERE po.status IN ('pending', 'ordered')) as pending_orders,
  COUNT(DISTINCT sp.id) as total_payments,
  COALESCE(SUM(po.total) FILTER (WHERE po.status = 'received' AND po.received_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as purchases_last_30_days
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN supplier_payments sp ON sp.supplier_id = s.id
GROUP BY s.id;

COMMENT ON VIEW supplier_summary IS 'Vista consolidada con información financiera de proveedores';
