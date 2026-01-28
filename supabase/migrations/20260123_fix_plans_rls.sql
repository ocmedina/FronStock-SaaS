-- Enable RLS on organizations if not already enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts (or create if not exists using a DO block)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update their own organization" ON organizations;
    DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Policy to allow users to view their own organization
CREATE POLICY "Users can view their own organization"
ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);

-- Policy to allow users (admins/owners) to update their own organization
CREATE POLICY "Users can update their own organization"
ON organizations FOR UPDATE
USING (
    id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
);
