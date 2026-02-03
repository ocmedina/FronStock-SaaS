-- Create a storage bucket for organization logos if it doesn't exist
insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket
create policy "Logo images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'organization-logos' );

create policy "Users can upload their own organization logo"
  on storage.objects for insert
  with check (
    bucket_id = 'organization-logos'
    and auth.role() = 'authenticated'
    -- Ensure the path starts with the user's organization_id
    and (storage.foldername(name))[1] in (
      select organization_id::text from profiles where id = auth.uid()
    )
  );

create policy "Users can update their own organization logo"
  on storage.objects for update
  using (
    bucket_id = 'organization-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (
      select organization_id::text from profiles where id = auth.uid()
    )
  );

create policy "Users can delete their own organization logo"
  on storage.objects for delete
  using (
    bucket_id = 'organization-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (
      select organization_id::text from profiles where id = auth.uid()
    )
  );
