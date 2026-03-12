-- =========================================================
-- db/migrations/100_audit_snapshots.sql
-- =========================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,

  actor_user_id uuid references users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert','update','delete')),

  occurred_at timestamptz not null default now(),
  reason text,
  diff jsonb not null
);

create index if not exists idx_audit_entity on audit_log (tenant_id, entity_type, entity_id, occurred_at desc);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  snapshot_type text not null, -- 'bank_input','bank_output','pricing_input','pricing_output','calc_output'
  created_at timestamptz not null default now(),
  created_by uuid references users(id) on delete set null,

  payload jsonb not null,
  payload_hash text not null
);

create index if not exists idx_snapshots_loan_type on snapshots (tenant_id, loan_id, snapshot_type, created_at desc);
