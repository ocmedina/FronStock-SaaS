-- =============================================================================
-- MIGRACIÓN: Sistema de Promociones y Descuentos
-- Fecha: 2026-02-05
-- Descripción: Sistema completo de gestión de promociones con múltiples tipos
-- =============================================================================

-- 1. Crear tabla de promociones
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('percentage', 'fixed_amount', 'volume', 'combo', 'happy_hour', 'coupon')) NOT NULL,
  
  -- Configuración del descuento
  discount_percentage NUMERIC CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount NUMERIC CHECK (discount_amount >= 0),
  
  -- Condiciones
  min_quantity INTEGER CHECK (min_quantity > 0),
  min_amount NUMERIC CHECK (min_amount >= 0),
  buy_quantity INTEGER CHECK (buy_quantity > 0),
  get_quantity INTEGER CHECK (get_quantity >= 0),
  
  -- Productos aplicables
  applies_to TEXT CHECK (applies_to IN ('all', 'specific', 'category')) DEFAULT 'all',
  product_ids UUID[],
  category_ids UUID[],
  
  -- Clientes aplicables
  customer_type TEXT CHECK (customer_type IN ('all', 'retail', 'wholesale', 'specific')),
  customer_ids UUID[],
  
  -- Happy Hour
  start_time TIME,
  end_time TIME,
  days_of_week INTEGER[], -- 0=Domingo, 6=Sábado
  
  -- Cupones
  coupon_code TEXT,
  max_uses INTEGER CHECK (max_uses > 0),
  current_uses INTEGER DEFAULT 0 CHECK (current_uses >= 0),
  
  -- Vigencia
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_discount CHECK (
    (discount_percentage IS NOT NULL AND discount_amount IS NULL) OR
    (discount_percentage IS NULL AND discount_amount IS NOT NULL)
  ),
  CONSTRAINT valid_coupon CHECK (
    (type = 'coupon' AND coupon_code IS NOT NULL) OR
    (type != 'coupon')
  )
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_promotions_org ON promotions(organization_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, start_date, end_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_coupon ON promotions(coupon_code) WHERE coupon_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_type ON promotions(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_coupon_unique ON promotions(organization_id, coupon_code) WHERE coupon_code IS NOT NULL;

-- 3. Tabla de usos de promociones
CREATE TABLE IF NOT EXISTS promotion_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  discount_applied NUMERIC NOT NULL CHECK (discount_applied >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion ON promotion_usages(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_sale ON promotion_usages(sale_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_customer ON promotion_usages(customer_id);

-- 4. Habilitar RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de seguridad para promotions
CREATE POLICY "promotions_select" ON promotions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "promotions_insert" ON promotions FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "promotions_update" ON promotions FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "promotions_delete" ON promotions FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 6. Políticas de seguridad para promotion_usages
CREATE POLICY "promotion_usages_select" ON promotion_usages FOR SELECT
  USING (
    promotion_id IN (
      SELECT id FROM promotions WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "promotion_usages_insert" ON promotion_usages FOR INSERT
  WITH CHECK (
    promotion_id IN (
      SELECT id FROM promotions WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 7. Función para calcular descuentos aplicables
CREATE OR REPLACE FUNCTION calculate_applicable_promotions(
  p_org_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_subtotal NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_promotion RECORD;
  v_applicable_promotions JSONB := '[]'::JSONB;
  v_discount NUMERIC;
  v_current_time TIME := LOCALTIME;
  v_current_day INTEGER := EXTRACT(DOW FROM CURRENT_DATE);
  v_customer_type TEXT;
  v_total_quantity INTEGER := 0;
  v_item JSONB;
BEGIN
  -- Obtener tipo de cliente si existe
  IF p_customer_id IS NOT NULL THEN
    SELECT customer_type INTO v_customer_type FROM customers WHERE id = p_customer_id;
  END IF;
  
  -- Calcular cantidad total de items
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_total_quantity := v_total_quantity + COALESCE((v_item->>'quantity')::INTEGER, 0);
  END LOOP;

  -- Buscar promociones aplicables
  FOR v_promotion IN
    SELECT * FROM promotions
    WHERE organization_id = p_org_id
      AND active = true
      AND (start_date IS NULL OR start_date <= CURRENT_DATE)
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND (max_uses IS NULL OR current_uses < max_uses)
    ORDER BY 
      CASE 
        WHEN discount_amount IS NOT NULL THEN discount_amount
        WHEN discount_percentage IS NOT NULL THEN p_subtotal * (discount_percentage / 100)
        ELSE 0
      END DESC
  LOOP
    v_discount := 0;
    
    -- Validar tipo de cliente
    IF v_promotion.customer_type IS NOT NULL AND v_promotion.customer_type != 'all' THEN
      IF v_customer_type IS NULL THEN
        CONTINUE;
      END IF;
      
      IF v_promotion.customer_type = 'specific' THEN
        IF NOT (p_customer_id = ANY(v_promotion.customer_ids)) THEN
          CONTINUE;
        END IF;
      ELSIF v_promotion.customer_type != v_customer_type THEN
        CONTINUE;
      END IF;
    END IF;
    
    -- Validar Happy Hour
    IF v_promotion.type = 'happy_hour' THEN
      IF v_promotion.start_time IS NOT NULL AND v_promotion.end_time IS NOT NULL THEN
        IF v_current_time < v_promotion.start_time OR v_current_time > v_promotion.end_time THEN
          CONTINUE;
        END IF;
      END IF;
      IF v_promotion.days_of_week IS NOT NULL THEN
        IF NOT (v_current_day = ANY(v_promotion.days_of_week)) THEN
          CONTINUE;
        END IF;
      END IF;
    END IF;
    
    -- Calcular descuento según tipo
    IF v_promotion.type = 'percentage' THEN
      v_discount := p_subtotal * (v_promotion.discount_percentage / 100);
      
    ELSIF v_promotion.type = 'fixed_amount' THEN
      v_discount := LEAST(v_promotion.discount_amount, p_subtotal);
      
    ELSIF v_promotion.type = 'volume' THEN
      -- Validar cantidad o monto mínimo
      IF (v_promotion.min_quantity IS NOT NULL AND v_total_quantity >= v_promotion.min_quantity) OR
         (v_promotion.min_amount IS NOT NULL AND p_subtotal >= v_promotion.min_amount) THEN
        IF v_promotion.discount_percentage IS NOT NULL THEN
          v_discount := p_subtotal * (v_promotion.discount_percentage / 100);
        ELSIF v_promotion.discount_amount IS NOT NULL THEN
          v_discount := LEAST(v_promotion.discount_amount, p_subtotal);
        END IF;
      END IF;
      
    ELSIF v_promotion.type = 'happy_hour' THEN
      IF v_promotion.discount_percentage IS NOT NULL THEN
        v_discount := p_subtotal * (v_promotion.discount_percentage / 100);
      ELSIF v_promotion.discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_promotion.discount_amount, p_subtotal);
      END IF;
      
    ELSIF v_promotion.type = 'coupon' THEN
      -- Los cupones se aplican manualmente, no automáticamente
      CONTINUE;
    END IF;
    
    -- Agregar a lista si hay descuento
    IF v_discount > 0 THEN
      v_applicable_promotions := v_applicable_promotions || jsonb_build_object(
        'id', v_promotion.id,
        'name', v_promotion.name,
        'type', v_promotion.type,
        'discount', ROUND(v_discount, 2),
        'description', v_promotion.description
      );
    END IF;
  END LOOP;
  
  RETURN v_applicable_promotions;
END;
$$;

-- 8. Función para aplicar cupón
CREATE OR REPLACE FUNCTION apply_coupon(
  p_org_id UUID,
  p_coupon_code TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_promotion RECORD;
  v_discount NUMERIC := 0;
BEGIN
  -- Buscar cupón
  SELECT * INTO v_promotion
  FROM promotions
  WHERE organization_id = p_org_id
    AND coupon_code = UPPER(TRIM(p_coupon_code))
    AND type = 'coupon'
    AND active = true
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cupón no válido o expirado');
  END IF;
  
  -- Calcular descuento
  IF v_promotion.discount_percentage IS NOT NULL THEN
    v_discount := p_subtotal * (v_promotion.discount_percentage / 100);
  ELSIF v_promotion.discount_amount IS NOT NULL THEN
    v_discount := LEAST(v_promotion.discount_amount, p_subtotal);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'promotion_id', v_promotion.id,
    'name', v_promotion.name,
    'discount', ROUND(v_discount, 2),
    'description', v_promotion.description
  );
END;
$$;

-- 9. Función para incrementar uso de promoción
CREATE OR REPLACE FUNCTION increment_promotion_usage(p_promotion_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promotions
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = p_promotion_id;
END;
$$;

-- 10. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_promotion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promotion_timestamp ON promotions;
CREATE TRIGGER trigger_update_promotion_timestamp
BEFORE UPDATE ON promotions
FOR EACH ROW
EXECUTE FUNCTION update_promotion_timestamp();

-- Comentarios
COMMENT ON TABLE promotions IS 'Gestión de promociones y descuentos';
COMMENT ON COLUMN promotions.type IS 'Tipo: percentage, fixed_amount, volume, combo, happy_hour, coupon';
COMMENT ON COLUMN promotions.applies_to IS 'Aplicable a: all (todos), specific (productos específicos), category (categorías)';
COMMENT ON TABLE promotion_usages IS 'Registro de usos de promociones en ventas';
