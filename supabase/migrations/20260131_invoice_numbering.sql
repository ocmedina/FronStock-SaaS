-- Function to get the next sequential invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number(
  p_organization_id UUID,
  p_invoice_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_number TEXT;
  v_sequence INT;
  v_point_of_sale TEXT := '0001'; -- Default point of sale
BEGIN
  -- Get the last invoice number for this organization and type
  SELECT invoice_number
  INTO v_last_number
  FROM invoices
  WHERE organization_id = p_organization_id
    AND type = p_invoice_type
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no previous invoice, start with 1
  IF v_last_number IS NULL THEN
    RETURN v_point_of_sale || '-00000001';
  END IF;

  -- Extract the sequence number (assuming format XXXX-YYYYYYYY)
  -- We split by '-' and take the second part
  BEGIN
    v_sequence := split_part(v_last_number, '-', 2)::INT;
    v_sequence := v_sequence + 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if parsing fails (e.g. invalid format in DB), start fresh or handle error
    -- For safety, we'll return a random large number to avoid collision if format is messed up, 
    -- but ideally we should enforce format. For this MVP, we reset to 1 if parsing fails implies 
    -- manual intervention might be needed, but let's just increment MAX found or default.
    -- Better safe fallback: count + 1
    SELECT COUNT(*) + 1 INTO v_sequence
    FROM invoices
    WHERE organization_id = p_organization_id
      AND type = p_invoice_type;
  END;

  -- Format with leading zeros (8 digits)
  RETURN v_point_of_sale || '-' || LPAD(v_sequence::TEXT, 8, '0');
END;
$$;
