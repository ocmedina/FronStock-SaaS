-- Table to store AFIP credentials per organization
create table if not exists afip_credentials (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade not null,
  cuit text not null,
  cert_content text, -- Storing as text for simplicity in this MVP. In production, consider encryption or Storage.
  key_content text,  -- Storing as text for simplicity in this MVP. In production, consider encryption or Storage.
  is_production boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(organization_id)
);

-- RLS Policies
alter table afip_credentials enable row level security;

create policy "Users can view their organization credentials"
  on afip_credentials for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

create policy "Users can insert/update their organization credentials"
  on afip_credentials for all
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );
