-- =========================================================
-- db/migrations/118_exceptions_v2.sql
--
-- Upgrades the exceptions table from the lean v1 scaffold
-- (070_exceptions.sql) to the full exception module schema.
--
-- Changes to exceptions table:
--   1. loan_id → nullable  (supports pre-file / global exceptions)
--   2. Add rich underwriting fields: guideline_value, actual_value,
--      variance, justification, compensating_factors, risk_factors,
--      loan_snapshot (JSONB), exception_source
--   3. Attach audit trigger
--
-- New tables:
--   exception_events      — immutable event log (append-only)
--   exception_comments    — immutable comment thread (append-only)
--   exception_documents   — junction: exceptions ↔ documents
--   exception_authority_rules — tenant-configurable approval matrix
-- =========================================================

-- ── 1. Make loan_id nullable ──────────────────────────────────────────────────
-- Pre-file exceptions (pricing, broker, eligibility) do not yet have a loan.
alter table exceptions alter column loan_id drop not null;

-- ── 2. Add rich underwriting fields ──────────────────────────────────────────
alter table exceptions add column if not exists guideline_value      text;
alter table exceptions add column if not exists actual_value         text;
alter table exceptions add column if not exists variance             text;
alter table exceptions add column if not exists justification        text;
alter table exceptions add column if not exists compensating_factors text;
alter table exceptions add column if not exists risk_factors         text;
alter table exceptions add column if not exists loan_snapshot        jsonb not null default '{}'::jsonb;
-- exception_source: 'pre_file' (no loan yet) | 'loan_file' (tied to a loan)
alter table exceptions add column if not exists exception_source     text not null default 'loan_file';

-- ── 3. Audit trigger on exceptions ───────────────────────────────────────────
drop trigger if exists audit_exceptions on exceptions;
create trigger audit_exceptions
  after insert or update or delete on exceptions
  for each row execute function log_audit_event();

-- ── 4. exception_events (append-only event log) ───────────────────────────────
create table if not exists exception_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete restrict,
  exception_id  uuid not null references exceptions(id) on delete cascade,
  event_type    text not null,
  -- created | approved | denied | withdrawn | closed | updated |
  -- comment_added | document_attached
  actor_user_id uuid references users(id) on delete set null,
  event_data    jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

create index if not exists idx_exception_events_exception
  on exception_events (exception_id, occurred_at);
create index if not exists idx_exception_events_tenant
  on exception_events (tenant_id, occurred_at desc);

-- ── 5. exception_comments (append-only) ──────────────────────────────────────
create table if not exists exception_comments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete restrict,
  exception_id uuid not null references exceptions(id) on delete cascade,
  body         text not null,
  created_by   uuid references users(id) on delete set null,
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_exception_comments_exception
  on exception_comments (exception_id, created_at);

-- ── 6. exception_documents (junction: exceptions ↔ documents) ────────────────
create table if not exists exception_documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete restrict,
  exception_id uuid not null references exceptions(id) on delete cascade,
  document_id  uuid not null references documents(id) on delete cascade,
  attached_by  uuid references users(id) on delete set null,
  attached_at  timestamptz not null default now(),
  unique (exception_id, document_id)
);

create index if not exists idx_exception_documents_exception
  on exception_documents (exception_id);

-- ── 7. exception_authority_rules (tenant-configurable approval matrix) ────────
-- Rows define which roles may approve exceptions of a given type and severity.
-- exception_type NULL = rule applies to all types.
-- max_severity: the highest severity level this rule covers.
-- allowed_roles: JSONB array of role name strings (e.g. ["underwriter","account_manager"]).
create table if not exists exception_authority_rules (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  exception_type        text,
  max_severity          text not null default 'critical',
  allowed_roles         jsonb not null default '["underwriter","account_manager","it_admin"]'::jsonb,
  requires_dual_approval boolean not null default false,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_exception_authority_tenant
  on exception_authority_rules (tenant_id, is_active);

drop trigger if exists update_exception_authority_rules_updated_at on exception_authority_rules;
create trigger update_exception_authority_rules_updated_at
  before update on exception_authority_rules
  for each row execute procedure update_updated_at_column();

-- ── 8. Additional indexes on exceptions ──────────────────────────────────────
-- Supports "open exceptions for this loan" query from workspace panel
create index if not exists idx_exceptions_loan_status
  on exceptions (loan_id, status) where loan_id is not null;

-- Supports "all open exceptions for this tenant" query from exception queue
create index if not exists idx_exceptions_tenant_status
  on exceptions (tenant_id, status, created_at desc);
