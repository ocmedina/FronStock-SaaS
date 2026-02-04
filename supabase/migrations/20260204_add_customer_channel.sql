-- Add sales_channel to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS sales_channel text DEFAULT 'general' 
CHECK (sales_channel IN ('general', 'delivery', 'counter'));

-- Update existing customers to be 'general' (or 'delivery' if easier for migration, but 'general' is safer)
UPDATE customers SET sales_channel = 'general' WHERE sales_channel IS NULL;
