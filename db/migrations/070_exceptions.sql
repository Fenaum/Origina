-- =========================================================
-- db/migrations/070_exceptions.sql
-- =========================================================
create table if not exists exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  exception_type text not null, -- pricing/ltv/credit/eligibility/etc
  title text not null,
  description text,

  status exception_status not null default 'open',
  severity exception_severity not null default 'medium',

  requested_by uuid references users(id) on delete set null,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exceptions_open on exceptions (tenant_id, loan_id, status);

drop trigger if exists update_exceptions_updated_at on exceptions;
create trigger update_exceptions_updated_at
before update on exceptions
for each row
execute procedure update_updated_at_column();
