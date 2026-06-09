-- =========================================================
-- db/migrations/109_fix_audit_trigger.sql
--
-- Fixes log_audit_event() to handle satellite tables
-- (loan_financials, loan_terms) that use loan_id as PK
-- instead of id.
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
  -- Tables whose PK is loan_id, not id.
  _LOAN_ID_PK constant text[] := array['loan_financials', 'loan_terms'];
begin
  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    if tg_table_name = any(_LOAN_ID_PK) then
      v_entity_id := old.loan_id;
    else
      v_entity_id := old.id;
    end if;
  else
    v_tenant_id := new.tenant_id;
    if tg_table_name = any(_LOAN_ID_PK) then
      v_entity_id := new.loan_id;
    else
      v_entity_id := new.id;
    end if;
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
