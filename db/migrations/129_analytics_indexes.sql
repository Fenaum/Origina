-- =========================================================
-- db/migrations/129_analytics_indexes.sql
--
-- Adds the composite and partial indexes required by the
-- analytics dashboard (see docs/architecture/dashboard.md,
-- Section 6). These support KPI cards, chart aggregates, and
-- drill-down query patterns in analytics_repo.py.
--
-- Tenant-first composite indexes (tenant_id, ...) are the
-- primary lever — every analytics query filters by tenant.
-- =========================================================

BEGIN;

-- ── loans: submitted_at trend (monthly submission chart) ─────────────────────
-- Covers: date_trunc('month', submitted_at) groupings.
-- Partial index skips NULL rows (drafts have no submission date yet).
CREATE INDEX IF NOT EXISTS idx_loans_tenant_submitted
  ON loans (tenant_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

-- ── loans: loan_program distribution (channel mix chart) ─────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_tenant_program
  ON loans (tenant_id, loan_program)
  WHERE loan_program IS NOT NULL;

-- ── loans: purpose (purchase / refinance / cash_out) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_tenant_purpose
  ON loans (tenant_id, purpose);

-- ── loans: created_at range scans (default analytics ordering) ────────────────
-- Already exists as idx_loans_tenant_created from 050_loans.sql — verify only.
-- (Listed here for documentation purposes; no CREATE needed.)

-- ── loan_financials: amount aggregates ───────────────────────────────────────
-- Volume-by-status joins loan_financials on loan_id and aggregates loan_amount.
-- A composite (tenant_id, loan_amount) covers the SUM path; the PK index on
-- loan_id already handles the JOIN side.
CREATE INDEX IF NOT EXISTS idx_loan_financials_tenant_amount
  ON loan_financials (tenant_id, loan_amount)
  WHERE loan_amount IS NOT NULL;

-- ── conditions: by status (open / submitted counts) ──────────────────────────
-- The existing idx_conditions_tenant_loan covers loan-scoped aggregates.
-- This index is the standalone status filter (e.g., COUNT(*) WHERE status='open').
CREATE INDEX IF NOT EXISTS idx_conditions_tenant_status
  ON conditions (tenant_id, status);

-- ── loan_status_events: aging queries ────────────────────────────────────────
-- idx_loan_status_events (tenant_id, loan_id, occurred_at DESC) was added in
-- 073_loan_status_events.sql. Aging CTEs use DISTINCT ON (loan_id) ordered by
-- occurred_at DESC — that index is already optimal. Documented for reference.

-- ── loans: stale-files detection (no update in 72h) ───────────────────────────
-- Already covered by idx_loans_tenant_created / the loans PK.
-- The (tenant_id, updated_at) composite is the optimal form.
CREATE INDEX IF NOT EXISTS idx_loans_tenant_updated
  ON loans (tenant_id, updated_at);

COMMIT;