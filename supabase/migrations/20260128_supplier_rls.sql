-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy for viewing suppliers
CREATE POLICY "Users can view suppliers from their organization"
ON suppliers FOR SELECT
TO authenticated
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Policy for inserting suppliers (just in case needed here or elsewhere)
CREATE POLICY "Users can insert suppliers for their organization"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Policy for updating suppliers
CREATE POLICY "Users can update suppliers from their organization"
ON suppliers FOR UPDATE
TO authenticated
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Policy for deleting suppliers
CREATE POLICY "Users can delete suppliers from their organization"
ON suppliers FOR DELETE
TO authenticated
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
