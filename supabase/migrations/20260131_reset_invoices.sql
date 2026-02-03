-- Function to reset (delete) all invoices for an organization
CREATE OR REPLACE FUNCTION reset_invoices(
  p_organization_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_org_id UUID;
BEGIN
  -- Security Check: Verify the executing user belongs to the passed organization_id
  -- This prevents cross-tenant data deletion in SaaS
  SELECT organization_id INTO v_user_org_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Access Denied: You can only delete invoices for your own organization.';
  END IF;

  -- Delete all invoices for this organization
  DELETE FROM invoices
  WHERE organization_id = p_organization_id;

  -- The numeration resets automatically because get_next_invoice_number calculates based on MAX(existing).
  -- If table is empty for that org, it starts at 1.
END;
$$;
