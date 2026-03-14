-- Delivery route policy configuration at organization level
-- Allows admins to decide if drivers can operate orders without an active route.

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS delivery_without_route_mode boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN organizations.delivery_without_route_mode IS
'If true, delivery app can operate orders without an active route assigned to the driver.';
