-- Enable RLS on profiles if not already enabled
alter table profiles enable row level security;

-- 1. Allow users to view their own profile (usually exists, but good to ensure)
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

-- 2. Allow users to update their own profile
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- 3. Allow users to view all profiles in their SAME organization
-- This is crucial for the Users list to work
create policy "Users can view profiles in their organization"
  on profiles for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

-- 4. Allow Admins/Owners to update roles/profiles in their organization
create policy "Admins can update profiles in their organization"
  on profiles for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'owner')
      and organization_id = profiles.organization_id
    )
  );
