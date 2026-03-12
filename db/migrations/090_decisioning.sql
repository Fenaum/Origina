-- =========================================================
-- db/migrations/090_decisioning.sql
-- =========================================================
create table if not exists pricing_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  run_at timestamptz not null default now(),
  run_by uuid references users(id) on delete set null,

  input_hash text not null,
  input_payload jsonb not null,
  output_payload jsonb not null
);

create index if not exists idx_pricing_runs on pricing_runs (tenant_id, loan_id, run_at desc);

create table if not exists eligibility_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  run_at timestamptz not null default now(),
  run_by uuid references users(id) on delete set null,

  input_hash text not null,
  input_payload jsonb not null,
  output_payload jsonb not null
);

create index if not exists idx_elig_runs on eligibility_runs (tenant_id, loan_id, run_at desc);
