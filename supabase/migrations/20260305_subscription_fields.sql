-- Add subscription tracking fields to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS mp_subscription_id text,
ADD COLUMN IF NOT EXISTS mp_subscription_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS plan_expires_at timestamp with time zone;

-- Index for quick subscription lookups
CREATE INDEX IF NOT EXISTS idx_organizations_mp_subscription_id
ON organizations(mp_subscription_id) WHERE mp_subscription_id IS NOT NULL;

COMMENT ON COLUMN organizations.mp_subscription_id IS 'Mercado Pago preapproval (subscription) ID';
COMMENT ON COLUMN organizations.mp_subscription_status IS 'Estado de la suscripción MP: none, pending, authorized, paused, cancelled';
COMMENT ON COLUMN organizations.plan_expires_at IS 'Fecha de vencimiento del período actual de suscripción';
