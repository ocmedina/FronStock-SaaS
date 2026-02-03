-- Add CUIT column to customers table for invoice generation
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cuit VARCHAR(13);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_cuit ON customers(cuit);

-- Add comment
COMMENT ON COLUMN customers.cuit IS 'CUIT del cliente en formato XX-XXXXXXXX-X';