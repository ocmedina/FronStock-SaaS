-- Add new columns to organizations table for company settings
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS cuit VARCHAR(20),
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS tax_condition VARCHAR(50), -- Responsable Inscripto, Monotributo, etc.
ADD COLUMN IF NOT EXISTS activity_start_date DATE,
ADD COLUMN IF NOT EXISTS gross_income_number VARCHAR(50); -- Ingresos Brutos

-- Comment on columns for documentation
COMMENT ON COLUMN organizations.address IS 'Physical address of the organization';
COMMENT ON COLUMN organizations.cuit IS 'Tax ID (CUIT) of the organization';
COMMENT ON COLUMN organizations.logo_url IS 'URL to the organization logo';
COMMENT ON COLUMN organizations.tax_condition IS 'Fiscal condition (e.g. Responsable Inscripto)';
