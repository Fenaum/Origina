-- =========================================================
-- db/migrations/060_properties.sql
-- =========================================================
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  is_subject boolean not null default true,

  address1 text,
  address2 text,
  city text,
  state text,
  postal_code text,

  property_type text,
  occupancy text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_loan on properties (tenant_id, loan_id);

drop trigger if exists update_properties_updated_at on properties;
create trigger update_properties_updated_at
before update on properties
for each row
execute procedure update_updated_at_column();
