-- Add city column to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN organizations.city IS 'City/locality of the organization, shown on invoices and documents';
