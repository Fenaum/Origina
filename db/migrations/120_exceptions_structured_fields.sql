-- =========================================================
-- db/migrations/120_exceptions_structured_fields.sql
--
-- Phase 2: Replace free-text exception fields with structured,
-- reportable data. Auditors can now query by category, type,
-- reason code, metric variance, and factor codes without
-- parsing free text.
--
-- All ADD COLUMN statements use IF NOT EXISTS for idempotency.
-- All CHECK constraints use DROP IF EXISTS + ADD to allow re-runs.
-- JSONB type conversions preserve existing free-text as
-- {code: "other", notes: "<original text>"} objects.
-- =========================================================

-- ── 1. Primary category (required, single value) ──────────────────────────────
-- The top-level reporting dimension. One value only — no ambiguity in reports.
alter table exceptions add column if not exists
  primary_category text not null default 'other';

alter table exceptions drop constraint if exists ck_exception_primary_category;
alter table exceptions add constraint ck_exception_primary_category check (
  primary_category in (
    'credit',
    'collateral',
    'income',
    'assets_reserves',
    'pricing',
    'product_guideline',
    'broker_account',
    'documentation',
    'compliance',
    'other'
  )
);

-- ── 2. Reason code (required, single value) ───────────────────────────────────
alter table exceptions add column if not exists
  reason_code text not null default 'other';

alter table exceptions drop constraint if exists ck_exception_reason_code;
alter table exceptions add constraint ck_exception_reason_code check (
  reason_code in (
    'strong_borrower_profile',
    'minor_guideline_variance',
    'competitive_price_match',
    'investor_relationship',
    'strategic_broker_relationship',
    'operational_exception',
    'prior_approval_precedent',
    'compensating_risk_profile',
    'other'
  )
);

-- ── 3. Related categories (multi-select for cross-category reporting) ─────────
-- Values are validated at the application layer, not DB level, because
-- PostgreSQL does not support per-element CHECK constraints on JSONB arrays
-- without a trigger. The array contains the same values as primary_category.
alter table exceptions add column if not exists
  related_categories jsonb not null default '[]'::jsonb;

-- ── 4. Context type (structured replacement for exception_source) ─────────────
-- Backfill from the existing exception_source column, then add constraint.
alter table exceptions add column if not exists
  context_type text not null default 'loan_file';

update exceptions
  set context_type = exception_source
  where exception_source is not null and context_type = 'loan_file';

alter table exceptions drop constraint if exists ck_exception_context_type;
alter table exceptions add constraint ck_exception_context_type check (
  context_type in ('pre_file', 'pricing_scenario', 'broker_account', 'loan_file')
);

-- ── 5. Workflow assignment fields ─────────────────────────────────────────────
alter table exceptions add column if not exists
  assigned_to uuid references users(id) on delete set null;

alter table exceptions add column if not exists
  submitted_at timestamptz;

-- ── 6. Structured numeric metric fields ───────────────────────────────────────
-- These parallel the existing guideline_value/actual_value TEXT display fields.
-- Use these columns for reporting queries (variance thresholds, aggregation).
-- TEXT display fields remain for human-readable rendering (e.g. "75% LTV max").

alter table exceptions add column if not exists metric_type text;
alter table exceptions add column if not exists guideline_operator text;
alter table exceptions add column if not exists metric_guideline numeric(10,4);
alter table exceptions add column if not exists metric_actual    numeric(10,4);
-- metric_variance is signed: positive = above guideline, negative = below
alter table exceptions add column if not exists metric_variance  numeric(10,4);
alter table exceptions add column if not exists metric_variance_unit text;

alter table exceptions drop constraint if exists ck_exception_metric_type;
alter table exceptions add constraint ck_exception_metric_type check (
  metric_type is null or metric_type in (
    'ltv', 'cltv', 'fico', 'dti', 'dscr',
    'rate', 'months', 'loan_amount', 'other'
  )
);

alter table exceptions drop constraint if exists ck_exception_guideline_operator;
alter table exceptions add constraint ck_exception_guideline_operator check (
  guideline_operator is null or guideline_operator in ('<=', '>=', '<', '>', '=')
);

alter table exceptions drop constraint if exists ck_exception_variance_unit;
alter table exceptions add constraint ck_exception_variance_unit check (
  metric_variance_unit is null or metric_variance_unit in (
    'pct', 'bps', 'months', 'dollars', 'points'
  )
);

-- ── 7. Loan snapshot integrity hash ──────────────────────────────────────────
alter table exceptions add column if not exists
  loan_snapshot_hash text;

-- ── 8. Convert compensating_factors: TEXT → JSONB array of {code, notes} ─────
-- Existing free-text values are wrapped as {code:"other", notes:"<text>"}.
-- NULL and empty strings become [].
alter table exceptions
  alter column compensating_factors type jsonb
  using case
    when compensating_factors is null or trim(compensating_factors) = ''
      then '[]'::jsonb
    else jsonb_build_array(
           jsonb_build_object('code', 'other', 'notes', compensating_factors)
         )
  end;

alter table exceptions alter column compensating_factors set not null;
alter table exceptions alter column compensating_factors set default '[]'::jsonb;

-- ── 9. Convert risk_factors: TEXT → JSONB array of {code, notes} ─────────────
alter table exceptions
  alter column risk_factors type jsonb
  using case
    when risk_factors is null or trim(risk_factors) = ''
      then '[]'::jsonb
    else jsonb_build_array(
           jsonb_build_object('code', 'other', 'notes', risk_factors)
         )
  end;

alter table exceptions alter column risk_factors set not null;
alter table exceptions alter column risk_factors set default '[]'::jsonb;

-- ── 10. Indexes ───────────────────────────────────────────────────────────────
-- Approver queue: open/submitted exceptions by severity
create index if not exists idx_exceptions_approver_queue
  on exceptions (tenant_id, primary_category, severity, created_at desc)
  where status in ('submitted', 'under_review', 'assigned');

-- Pre-file exception queue
create index if not exists idx_exceptions_pre_file
  on exceptions (tenant_id, context_type, created_at desc)
  where loan_id is null;

-- Category + type reporting
create index if not exists idx_exceptions_category_type
  on exceptions (tenant_id, primary_category, exception_type, status);

-- GIN indexes for JSONB containment queries on factors
create index if not exists idx_exceptions_comp_factors
  on exceptions using gin(compensating_factors);

create index if not exists idx_exceptions_risk_factors
  on exceptions using gin(risk_factors);

create index if not exists idx_exceptions_related_categories
  on exceptions using gin(related_categories);
