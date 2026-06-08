-- =========================================================
-- db/migrations/105_audit_triggers.sql
--
-- Creates the log_audit_event() trigger function and attaches
-- it to the four core tables that require an automatic audit trail.
--
-- HOW TO SATISFY actor_user_id:
--   At the start of every API request transaction, run:
--
--     SET LOCAL app.current_user_id = '<authenticated-user-uuid>';
--
--   FastAPI dependency or SQLAlchemy event hook is the right
--   place for this. "LOCAL" automatically clears on commit/rollback.
--   If the setting is absent (migration, direct SQL), actor is NULL.
--
-- TABLES COVERED HERE: loans, borrowers, conditions, documents
-- TABLES COVERED IN 108: loan_financials, loan_terms
--   (those tables don't exist yet when this migration runs)
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
    else
      v_diff := to_jsonb(old) - _REDACTED;
  end case;

  insert into audit_log (tenant_id, actor_user_id, entity_type, entity_id, action, diff)
  values (v_tenant_id, v_actor_id, tg_table_name, v_entity_id, lower(tg_op), v_diff);

  return null;
end;
$$;

-- ── loans ─────────────────────────────────────────────────────────────────────
drop trigger if exists audit_loans on loans;
create trigger audit_loans
  after insert or update or delete on loans
  for each row execute function log_audit_event();

-- ── borrowers ─────────────────────────────────────────────────────────────────
-- ssn_encrypted is stripped by the function; only ssn_last4 is logged.
drop trigger if exists audit_borrowers on borrowers;
create trigger audit_borrowers
  after insert or update or delete on borrowers
  for each row execute function log_audit_event();

-- ── conditions ────────────────────────────────────────────────────────────────
drop trigger if exists audit_conditions on conditions;
create trigger audit_conditions
  after insert or update or delete on conditions
  for each row execute function log_audit_event();

-- ── documents ─────────────────────────────────────────────────────────────────
-- Documents are immutable once uploaded, so only INSERT fires in practice.
-- The trigger is attached for all operations so accidental deletes are also
-- captured.
drop trigger if exists audit_documents on documents;
create trigger audit_documents
  after insert or update or delete on documents
  for each row execute function log_audit_event();
