-- =========================================================
-- db/functions/log_audit_event.sql
--
-- Generic audit trigger function. Attach to any table that has
-- tenant_id (uuid) and id (uuid) columns. Writes one row to
-- audit_log per INSERT, UPDATE, or DELETE.
--
-- Actor resolution:
--   The application layer must run the following at the start
--   of every database transaction (before any DML):
--
--     SET LOCAL app.current_user_id = '<user-uuid>';
--
--   "LOCAL" scopes the setting to the current transaction so it
--   is automatically cleared on commit or rollback. If the
--   setting is absent or blank (e.g., in a migration or direct
--   SQL session), actor_user_id is recorded as NULL.
--
-- Sensitive column exclusion:
--   ssn_encrypted and password_hash are stripped from the diff
--   before writing to audit_log. Never log raw credentials or
--   encrypted PII into an append-only audit table.
--
-- This file is the documentation copy.
-- The canonical definition lives in 105_audit_triggers.sql,
-- which is what db_migrate.sh executes.
-- =========================================================

create or replace function log_audit_event()
returns trigger
language plpgsql
as $$
declare
  v_tenant_id uuid;
  v_entity_id uuid;
  v_actor_id  uuid;
  v_diff      jsonb;
  _REDACTED   constant text[] := array['ssn_encrypted', 'password_hash'];
begin
  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_entity_id := old.id;
  else
    v_tenant_id := new.tenant_id;
    v_entity_id := new.id;
  end if;

  begin
    v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_actor_id := null;
  end;

  case tg_op
    when 'INSERT' then
      v_diff := to_jsonb(new) - _REDACTED;
    when 'UPDATE' then
      v_diff := jsonb_build_object(
        'before', to_jsonb(old) - _REDACTED,
        'after',  to_jsonb(new) - _REDACTED
      );
    else -- DELETE
      v_diff := to_jsonb(old) - _REDACTED;
  end case;

  insert into audit_log (tenant_id, actor_user_id, entity_type, entity_id, action, diff)
  values (v_tenant_id, v_actor_id, tg_table_name, v_entity_id, lower(tg_op), v_diff);

  return null;
end;
$$;
