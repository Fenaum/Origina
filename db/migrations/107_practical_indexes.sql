-- =========================================================
-- db/migrations/107_practical_indexes.sql
--
-- Adds indexes that serve real query patterns in pipeline management
-- and compliance reporting.
--
-- NOTE: documents already has idx_documents_loan covering
-- (tenant_id, loan_id, uploaded_at desc) from 080_documents.sql.
-- No duplicate is added here.
-- =========================================================

-- ── loans: closing date (pipeline/compliance reports) ────────────────────────
-- "Show loans closing this week / this month" is a daily pipeline query.
-- Partial index skips NULL rows (most loans in draft/submitted don't have
-- a closing date yet), keeping the index small and writes cheap.
create index if not exists idx_loans_closing_date
  on loans (tenant_id, closing_date)
  where closing_date is not null;

-- ── loans: funding date (post-close reporting) ────────────────────────────────
-- Funding-date range queries are the foundation of volume reports and
-- investor delivery schedules. Same partial index rationale as above.
create index if not exists idx_loans_funding_date
  on loans (tenant_id, funding_date)
  where funding_date is not null;

-- ── users: active users per tenant ───────────────────────────────────────────
-- RBAC checks and loan assignment dropdowns always filter is_active = true.
-- A partial index on the active minority is far smaller than a full index
-- on the boolean column (which would be almost useless at full table scale).
create index if not exists idx_users_active
  on users (tenant_id)
  where is_active = true;
