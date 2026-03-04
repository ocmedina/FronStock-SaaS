-- =============================================================================
-- MIGRACIÓN: CIERRE DIARIO DE CAJA
-- Fecha: 2026-03-04
-- =============================================================================

CREATE TABLE IF NOT EXISTS cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  closure_date date NOT NULL,
  sold_total numeric(12,2) NOT NULL DEFAULT 0,
  sold_local numeric(12,2) NOT NULL DEFAULT 0,
  sold_delivery numeric(12,2) NOT NULL DEFAULT 0,
  collected_total numeric(12,2) NOT NULL DEFAULT 0,
  collected_local numeric(12,2) NOT NULL DEFAULT 0,
  collected_delivery numeric(12,2) NOT NULL DEFAULT 0,
  expenses_total numeric(12,2) NOT NULL DEFAULT 0,
  fiado_total numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash numeric(12,2) NOT NULL DEFAULT 0,
  expected_transfer numeric(12,2) NOT NULL DEFAULT 0,
  sold_by_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_by_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  expenses_by_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by uuid REFERENCES auth.users(id),
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_closings_org_date_unique UNIQUE (organization_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_cash_closings_org_date
  ON cash_closings (organization_id, closure_date DESC);

ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash closings from their organization"
  ON cash_closings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cash closings in their organization"
  ON cash_closings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update cash closings in their organization"
  ON cash_closings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
