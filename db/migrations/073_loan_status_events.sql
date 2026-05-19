-- =========================================================
-- db/migrations/073_loan_status_events.sql
-- =========================================================
create table if not exists loan_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  from_status loan_status,
  to_status loan_status not null,
  reason text,

  actor_user_id uuid references users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_loan_status_events on loan_status_events (tenant_id, loan_id, occurred_at desc);
