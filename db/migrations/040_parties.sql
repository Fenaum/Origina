-- =========================================================
-- db/migrations/040_parties.sql
-- =========================================================
create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,

  party_type party_type not null,
  display_name text not null,

  -- Person fields (nullable for company)
  first_name text,
  last_name text,
  dob date,

  -- Company fields (nullable for person)
  legal_name text,

  -- Contact
  phone text,
  email text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parties_tenant_display on parties (tenant_id, display_name);

drop trigger if exists update_parties_updated_at on parties;
create trigger update_parties_updated_at
before update on parties
for each row
execute procedure update_updated_at_column();
