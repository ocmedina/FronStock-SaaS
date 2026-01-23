-- FUNCTION: Get user's org ID securely (bypassing RLS) to prevent infinite recursion
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select organization_id from profiles where id = auth.uid();
$$;

-- Enable RLS
alter table profiles enable row level security;

-- CLEANUP: Remove potentially conflicting policies
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can view profiles in their organization" on profiles;
drop policy if exists "Users can view profiles in their same organization" on profiles;
drop policy if exists "Ver perfiles de mi empresa" on profiles;
drop policy if exists "Admins can update profiles in their organization" on profiles;
drop policy if exists "Admin edita perfiles" on profiles;

-- POLICY 1: View Own Profile
create policy "View own profile"
  on profiles for select
  using ( auth.uid() = id );

-- POLICY 2: View Organization Colleagues (Using the function to avoid recursion)
create policy "View org colleagues"
  on profiles for select
  using (
    organization_id = get_my_org_id()
  );

-- POLICY 3: Admins/Owners Update Access
create policy "Admins update org profiles"
  on profiles for update
  using (
    auth.uid() in (
      select id from profiles
      where role in ('admin', 'owner')
      and organization_id = profiles.organization_id
    )
  );

-- Grant execute on function to authenticated users
grant execute on function get_my_org_id to authenticated;
