-- Enable DELETE and UPDATE policies missing for orders and order_items
-- Migration: 2026-02-03_fix_rls

-- 1. Policies for ORDERS (Adding DELETE)
CREATE POLICY "Enable delete access for authenticated users" ON orders
    FOR DELETE
    TO authenticated
    USING (true);

-- 2. Policies for ORDER_ITEMS (Adding UPDATE and DELETE)
CREATE POLICY "Enable update access for authenticated users" ON order_items
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON order_items
    FOR DELETE
    TO authenticated
    USING (true);
