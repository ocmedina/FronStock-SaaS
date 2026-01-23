-- Create invoices table linked to sales
CREATE TABLE IF NOT EXISTS invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    sale_id uuid REFERENCES sales(id),
    customer_id uuid REFERENCES customers(id),
    
    -- Invoice details
    invoice_number text NOT NULL, -- Format: 0001-00001234
    type text NOT NULL, -- A, B, C, Note of Credit
    total numeric NOT NULL,
    status text NOT NULL DEFAULT 'issued', -- issued, annulled, error
    
    -- ARCA / AFIP fields
    cae text,
    cae_expiration timestamp with time zone,
    afip_status text DEFAULT 'pending', -- pending, authorised, rejected
    afip_error text,
    
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices from their organization"
    ON invoices FOR SELECT
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create invoices for their organization"
    ON invoices FOR INSERT
    WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update invoices from their organization"
    ON invoices FOR UPDATE
    USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
