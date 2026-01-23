-- Add delivery fields to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision,
ADD COLUMN IF NOT EXISTS visit_day integer, -- 0=Sunday, 1=Monday, etc.
ADD COLUMN IF NOT EXISTS route_order integer;

-- Add delivery fields to sales
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS delivery_status text CHECK (delivery_status IN ('pending', 'in_route', 'delivered', 'cancelled', 'returned')),
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS delivery_date timestamp with time zone;

-- Create index for delivery queries
CREATE INDEX IF NOT EXISTS idx_customers_visit_day ON customers(visit_day);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_status ON sales(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sales_assigned_to ON sales(assigned_to);

-- Create policy for drivers to see their assigned sales
CREATE POLICY "Drivers can view assigned sales"
    ON sales FOR SELECT
    USING (
        assigned_to = auth.uid() OR 
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );
