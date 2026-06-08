-- =========================================================
-- db/migrations/108_loan_split.sql
--
-- Splits the wide loans table into three focused tables:
--
--   loans          — header: identifiers, status, workflow dates,
--                    loan descriptor fields (program, purpose, type)
--   loan_financials — money amounts and risk ratios
--   loan_terms      — rate, rate-lock, and repayment structure
--
-- WHY split now:
--   loans had 50+ columns. Financial and term fields belong together
--   conceptually and will grow independently (e.g., adding ARM cap
--   fields to loan_terms, adding impound/escrow breakdown to
--   loan_financials). Splitting now, before production traffic,
--   avoids a future costly ALTER TABLE on a live table.
--
-- RELATIONSHIP: both satellite tables use loan_id as their primary
-- key, enforcing the 1:1 relationship at the schema level without
-- an extra surrogate key column.
--
-- DATA MIGRATION: existing loan rows are copied into both satellite
-- tables before the columns are dropped from loans. Runs in a single
-- transaction; rolls back cleanly if anything fails.
--
-- CHECK CONSTRAINTS: constraints that were on loans for the moved
-- columns are dropped from loans and recreated on the new tables.
-- =========================================================

-- ── 1. Create loan_financials ─────────────────────────────────────────────────
create table if not exists loan_financials (
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id   uuid primary key references loans(id) on delete cascade,

  loan_amount             numeric(14,2),
  purchase_price          numeric(14,2),
  appraised_value         numeric(14,2),
  down_payment            numeric(14,2),
  ltv                     numeric(5,2),
  cltv                    numeric(5,2),
  fico_score              integer,
  debt_to_income          numeric(5,2),
  dscr                    numeric(5,2),
  cash_reserves           numeric(14,2),
  monthly_rent            numeric(14,2),
  monthly_income          numeric(14,2),
  monthly_debt            numeric(14,2),
  other_income            numeric(14,2),
  other_debt              numeric(14,2),
  principal_and_interest  numeric(14,2),
  current_balance         numeric(14,2),
  escrow_amount           numeric(14,2),
  total_monthly_payment   numeric(14,2),
  property_taxes          numeric(14,2),
  homeowners_insurance    numeric(14,2),
  hoa_fees                numeric(14,2),
  other_expenses          numeric(14,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loan_financials_tenant on loan_financials (tenant_id);

-- ── 2. Create loan_terms ──────────────────────────────────────────────────────
create table if not exists loan_terms (
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id   uuid primary key references loans(id) on delete cascade,

  -- Rate lock fields kept together: when the lock was set, how long, when it expires
  interest_rate_locked  boolean default false,
  rate_lock_date        date,
  rate_lock_days        integer,
  lock_expiration_date  date,

  initial_rate          numeric(5,3),
  interest_rate         numeric(5,3),
  term_months           integer,
  amortization_type     text,
  prepayment_penalty    boolean,
  rate_type             text,
  payment_type          text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loan_terms_tenant on loan_terms (tenant_id);

-- ── 3. Populate satellite tables from existing loan rows ──────────────────────
insert into loan_financials (
  tenant_id, loan_id,
  loan_amount, purchase_price, appraised_value, down_payment,
  ltv, cltv, fico_score, debt_to_income, dscr,
  cash_reserves, monthly_rent, monthly_income, monthly_debt,
  other_income, other_debt, principal_and_interest, current_balance,
  escrow_amount, total_monthly_payment, property_taxes,
  homeowners_insurance, hoa_fees, other_expenses
)
select
  tenant_id, id,
  loan_amount, purchase_price, appraised_value, down_payment,
  ltv, cltv, fico_score, debt_to_income, dscr,
  cash_reserves, monthly_rent, monthly_income, monthly_debt,
  other_income, other_debt, principal_and_interest, current_balance,
  escrow_amount, total_monthly_payment, property_taxes,
  homeowners_insurance, hoa_fees, other_expenses
from loans;

insert into loan_terms (
  tenant_id, loan_id,
  interest_rate_locked, rate_lock_date, rate_lock_days, lock_expiration_date,
  initial_rate, interest_rate, term_months,
  amortization_type, prepayment_penalty, rate_type, payment_type
)
select
  tenant_id, id,
  interest_rate_locked, rate_lock_date, rate_lock_days, lock_expiration_date,
  initial_rate, interest_rate, term_months,
  amortization_type, prepayment_penalty, rate_type, payment_type
from loans;

-- ── 4. Add updated_at triggers to satellite tables ────────────────────────────
drop trigger if exists update_loan_financials_updated_at on loan_financials;
create trigger update_loan_financials_updated_at
  before update on loan_financials
  for each row execute procedure update_updated_at_column();

drop trigger if exists update_loan_terms_updated_at on loan_terms;
create trigger update_loan_terms_updated_at
  before update on loan_terms
  for each row execute procedure update_updated_at_column();

-- ── 5. Move CHECK constraints from loans to satellite tables ──────────────────
-- Drop from loans first (columns are about to be removed)
alter table loans
  drop constraint if exists chk_loans_ltv,
  drop constraint if exists chk_loans_cltv,
  drop constraint if exists chk_loans_fico,
  drop constraint if exists chk_loans_dti,
  drop constraint if exists chk_loans_dscr,
  drop constraint if exists chk_loans_initial_rate,
  drop constraint if exists chk_loans_interest_rate,
  drop constraint if exists chk_loans_term;

-- Recreate on loan_financials
alter table loan_financials
  add constraint chk_lf_ltv   check (ltv  between 0 and 200),
  add constraint chk_lf_cltv  check (cltv between 0 and 200),
  add constraint chk_lf_fico  check (fico_score between 300 and 850),
  add constraint chk_lf_dti   check (debt_to_income between 0 and 150),
  add constraint chk_lf_dscr  check (dscr >= 0);

-- Recreate on loan_terms
alter table loan_terms
  add constraint chk_lt_initial_rate  check (initial_rate  between 0 and 100),
  add constraint chk_lt_interest_rate check (interest_rate between 0 and 100),
  add constraint chk_lt_term         check (term_months    between 1 and 480);

-- ── 6. Add audit triggers (log_audit_event defined in 105) ────────────────────
drop trigger if exists audit_loan_financials on loan_financials;
create trigger audit_loan_financials
  after insert or update or delete on loan_financials
  for each row execute function log_audit_event();

drop trigger if exists audit_loan_terms on loan_terms;
create trigger audit_loan_terms
  after insert or update or delete on loan_terms
  for each row execute function log_audit_event();

-- ── 7. Drop moved columns from loans ─────────────────────────────────────────
-- Financial columns
alter table loans
  drop column if exists loan_amount,
  drop column if exists purchase_price,
  drop column if exists appraised_value,
  drop column if exists down_payment,
  drop column if exists ltv,
  drop column if exists cltv,
  drop column if exists fico_score,
  drop column if exists debt_to_income,
  drop column if exists dscr,
  drop column if exists cash_reserves,
  drop column if exists monthly_rent,
  drop column if exists monthly_income,
  drop column if exists monthly_debt,
  drop column if exists other_income,
  drop column if exists other_debt,
  drop column if exists principal_and_interest,
  drop column if exists current_balance,
  drop column if exists escrow_amount,
  drop column if exists total_monthly_payment,
  drop column if exists property_taxes,
  drop column if exists homeowners_insurance,
  drop column if exists hoa_fees,
  drop column if exists other_expenses;

-- Terms columns
alter table loans
  drop column if exists interest_rate_locked,
  drop column if exists rate_lock_date,
  drop column if exists rate_lock_days,
  drop column if exists lock_expiration_date,
  drop column if exists initial_rate,
  drop column if exists interest_rate,
  drop column if exists term_months,
  drop column if exists amortization_type,
  drop column if exists prepayment_penalty,
  drop column if exists rate_type,
  drop column if exists payment_type;
