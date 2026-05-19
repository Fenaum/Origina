-- =========================================================
-- db/migrations/030_types.sql
-- NOTE: fixed enum syntax (values must be quoted, no trailing comma)
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'party') then
    create type party as enum (
      'broker',
      'loan_officer',
      'loan_officer_assistant',
      'loan_processor',
      'jr_loan_processor',
      'underwriter',
      'jr_underwriter',
      'disclosure_specialist',
      'loan_setup_clerk',
      'account_manager',
      'assistant_account_manager',
      'closer',
      'post_closer',
      'funder',
      'lock_desk',
      'title_agent',
      'appraiser',
      'seller_agent',
      'buyer_agent',
      'settlement_agent',
      'appraisal_management_company',
      'waterfall_service_provider',
      'insurance_agent',
      'home_inspector',
      'contractor',
      'shipper',
      'servicer',
      'it_admin',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'party_type') then
    create type party_type as enum (
      'person',
      'company'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'loan_status') then
    create type loan_status as enum (
      'new_draft',
      'submitted',
      'conditions_review',
      'approved_pending',
      'approved',
      'denied',
      'closed',
      'funded',
      'post_closing',
      'archived',
      'withdrawn',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'loan_purpose') then
    create type loan_purpose as enum (
      'purchase',
      'refinance',
      'cash_out',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'condition_status') then
    create type condition_status as enum (
      'open',
      'submitted',
      'cleared',
      'waived',
      'rejected'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exception_status') then
    create type exception_status as enum (
      'open',
      'approved',
      'denied',
      'withdrawn',
      'closed'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exception_severity') then
    create type exception_severity as enum (
      'low',
      'medium',
      'high',
      'critical'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum (
      'todo',
      'in_progress',
      'blocked',
      'done',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum (
      'low',
      'normal',
      'high',
      'urgent'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'loan_party_role') then
    create type loan_party_role as enum (
      'borrower',
      'co_borrower',
      'broker',
      'seller',
      'realtor',
      'loan_officer',
      'processor',
      'underwriter',
      'other'
    );
  end if;
end $$;
