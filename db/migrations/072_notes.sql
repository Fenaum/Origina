-- =========================================================
-- db/migrations/072_notes.sql
-- =========================================================
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  body text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notes_loan on notes (tenant_id, loan_id, created_at desc);
