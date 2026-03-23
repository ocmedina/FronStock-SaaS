-- Add permissions password fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS require_permissions_password BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permissions_password TEXT;

-- Assuming this table is accessed by the frontend, ensure the RLS policies don't leak the password to everyone if not appropriate,
-- but since 'organizations' is typically readable by its members, we might need to expose it to the client to validate.
-- In a more secure setup, validation would happen via an RPC or Server Action, but the client needs to read it for now based on the plan.
