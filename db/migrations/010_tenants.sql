-- =========================================================
-- db/migrations/010_tenants.sql
-- =========================================================
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists update_tenants_updated_at on tenants;
create trigger update_tenants_updated_at
before update on tenants
for each row
execute procedure update_updated_at_column();
