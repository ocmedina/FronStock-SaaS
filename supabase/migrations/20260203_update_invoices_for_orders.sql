-- Add order_id to invoices table to support linking invoices to orders directly
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);

-- Update RLS policies if necessary (existing ones rely on organization_id so they might be fine, but good to check)
-- Ideally, we ensure that if order_id is present, the user has access to that order's organization
-- But since invoices already have organization_id, the existing policies usually suffice.
