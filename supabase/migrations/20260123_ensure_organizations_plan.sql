-- Add plan_type column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'free';

-- Add updated_at column to organizations table if it doesn't exist
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_plan_type ON organizations(plan_type);

-- Comment on column
COMMENT ON COLUMN organizations.plan_type IS 'Tipo de plan de suscripción: free, entrepreneur, business, enterprise';
