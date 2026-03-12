-- =========================================================
-- db/migrations/001_extensions.sql
-- =========================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
