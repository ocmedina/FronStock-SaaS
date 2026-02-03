-- Add payment_amount and delivered_at columns to orders table
-- Migration: 2026-02-03

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Add index for delivered orders
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN orders.payment_amount IS 'Monto realmente recibido al momento de la entrega';
COMMENT ON COLUMN orders.delivered_at IS 'Timestamp de cuando se marcó como entregado';
