-- db/functions/update_updated_at.sql
--
-- Trigger function that keeps updated_at current on every row update.
-- WHY a DB trigger instead of relying on Python:
--   If a row is ever updated by a direct SQL query, a migration, or a future
--   microservice, the Python ORM is bypassed — the trigger fires regardless.
--   The trigger is the last line of defence for timestamp accuracy.
--
-- This function is created in 001_extensions.sql (it must run before any
-- CREATE TRIGGER statement that references it). This file is documentation
-- only — do not re-run it separately.

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
