-- 121_exception_decisions.sql
-- Phase 3: Immutable decision records + mutable imposed conditions.
--
-- Rationale for the two-table design:
--   exception_decisions   → append-only log: one row per decide() call,
--                            captures who decided, when, and why.
--   exception_decision_conditions → mutable conditions imposed when
--                            decision_type = 'with_conditions'; each row
--                            tracks its own satisfy/waive lifecycle.
--
-- exceptions.decided_by/decided_at still set for terminal decisions so
-- the parent row carries the final answer without a join.

begin;

-- ── Exception decisions (append-only) ─────────────────────────────────────────
create table if not exists exception_decisions (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references tenants(id) on delete restrict,
  exception_id   uuid        not null references exceptions(id) on delete cascade,
  decision_type  text        not null,
  decided_by     uuid        references users(id) on delete set null,
  decided_at     timestamptz not null default now(),
  rationale      text,
  created_at     timestamptz not null default now(),
  constraint ck_exception_decision_type check (
    decision_type in (
      'as_requested',
      'with_conditions',
      'denied',
      'information_requested'
    )
  )
);

-- ── Exception decision conditions (mutable) ────────────────────────────────────
create table if not exists exception_decision_conditions (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             uuid        not null references tenants(id) on delete restrict,
  exception_id          uuid        not null references exceptions(id) on delete cascade,
  decision_id           uuid        not null references exception_decisions(id) on delete cascade,
  condition_category    text        not null default 'other',
  action                text        not null,
  target                text,
  imposed_value         text,
  imposed_value_numeric numeric(10, 4),
  is_required           boolean     not null default true,
  status                text        not null default 'pending',
  satisfaction_date     timestamptz,
  satisfaction_user_id  uuid        references users(id) on delete set null,
  expires_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint ck_exc_dec_condition_category check (
    condition_category in (
      'pricing', 'escrow', 'collateral', 'credit',
      'documentation', 'funding', 'compliance', 'other'
    )
  ),
  constraint ck_exc_dec_condition_status check (
    status in ('pending', 'satisfied', 'waived', 'expired')
  )
);

-- updated_at trigger (reuses the shared function from earlier migrations)
create trigger trg_exc_decision_conditions_updated_at
  before update on exception_decision_conditions
  for each row execute function update_updated_at_column();

-- audit trigger so every satisfy/waive is recorded in audit_log
create trigger trg_exc_decision_conditions_audit
  after insert or update or delete on exception_decision_conditions
  for each row execute function log_audit_event();

-- ── Indexes ────────────────────────────────────────────────────────────────────
create index if not exists idx_exception_decisions_exception_id
  on exception_decisions (exception_id, created_at desc);

create index if not exists idx_exception_decisions_tenant_type
  on exception_decisions (tenant_id, decision_type, decided_at desc);

create index if not exists idx_exc_dec_conditions_decision_id
  on exception_decision_conditions (decision_id);

-- Partial index to quickly find unresolved conditions
create index if not exists idx_exc_dec_conditions_pending
  on exception_decision_conditions (exception_id, status)
  where status = 'pending';

commit;
