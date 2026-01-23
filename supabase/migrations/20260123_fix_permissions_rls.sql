-- Enable RLS on organization_permissions
alter table organization_permissions enable row level security;

-- CLEANUP
drop policy if exists "View org permissions" on organization_permissions;
drop policy if exists "Mangage org permissions" on organization_permissions;

-- POLICY 1: View Organization Permissions (All users in the org needs to see them to know what they can do)
create policy "View org permissions"
  on organization_permissions for select
  using (
    organization_id = get_my_org_id()
  );

-- POLICY 2: Manage Organization Permissions (Only Admins/Owners)
create policy "Manage org permissions"
  on organization_permissions for all
  using (
    -- Check if user is admin/owner of THIS organization
    auth.uid() in (
      select id from profiles
      where role in ('admin', 'owner')
      and organization_id = organization_permissions.organization_id
    )
  );
