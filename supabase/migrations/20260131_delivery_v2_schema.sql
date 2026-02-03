-- =============================================================================
-- MIGRACIÓN DE DELIVERY 2.0 (2026-01-31)
-- =============================================================================

-- 1. Ampliar tabla SALES con campos operativos de delivery
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS estimated_mins integer DEFAULT 0, -- Demora estimada
ADD COLUMN IF NOT EXISTS delivery_fee decimal(10,2) DEFAULT 0, -- Costo de envío
ADD COLUMN IF NOT EXISTS payment_amount decimal(10,2) DEFAULT 0; -- Con cuánto abona el cliente (para cambio)

-- 2. Tabla para Control de Caja de Repartidores (Rendiciones)
-- Permite saber cuánto dinero tiene el repartidor en la mano
CREATE TABLE IF NOT EXISTS delivery_shifts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid REFERENCES organizations(id),
    driver_id uuid REFERENCES profiles(id),
    start_time timestamptz DEFAULT now(),
    end_time timestamptz,
    initial_cash decimal(10,2) DEFAULT 0, -- Base de cambio
    collected_cash decimal(10,2) DEFAULT 0, -- Dinero cobrado
    returned_cash decimal(10,2) DEFAULT 0, -- Dinero rendido al cerrar
    status text DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_sales_delivery_status_v2 ON sales(delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_shifts_driver ON delivery_shifts(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_shifts_org ON delivery_shifts(organization_id);

-- 3. Función simplificada para asignar repartidor
CREATE OR REPLACE FUNCTION assign_driver(
    p_sale_id uuid,
    p_driver_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sales
    SET 
        assigned_to = p_driver_id,
        delivery_status = 'out_for_delivery', -- Auto-update status to "En Camino"
        updated_at = now()
    WHERE id = p_sale_id;
    
    RETURN FOUND;
END;
$$;

-- RLS Policies for new table
ALTER TABLE delivery_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts from their organization"
  ON delivery_shifts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage shifts from their organization"
  ON delivery_shifts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
