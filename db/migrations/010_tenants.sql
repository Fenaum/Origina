-- =========================================================
-- db/migrations/010_tenants.sql
-- =========================================================
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
