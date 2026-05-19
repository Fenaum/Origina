-- =========================================================
-- db/migrations/103_check_constraints.sql
--
-- Database-level guardrails for numeric ranges on loans and borrowers.
--
-- WHY CHECK constraints at the DB level when we already validate in Python:
--   Application validation runs at the API boundary — it catches bad input
--   from the UI or API consumers. But data can enter the DB through other
--   paths: bulk imports, direct SQL access by an admin, a future internal
--   service that forgets to validate, or a bug that bypasses the API layer.
--   CHECK constraints fire on every INSERT and UPDATE regardless of source.
--   They are the last line of defence and cost nothing at read time.
--
-- WHY these specific bounds:
--   ltv/cltv  0–200  — industry norm is <100%; 200 still catches typos like
--                       "1050" (meant 10.50%) while allowing extreme Non-QM.
--   fico      300–850 — the full FICO score range; outside this is impossible.
--   dti       0–150  — covers even distressed borrowers; >150 is always a
--                       data entry error (e.g., 5000 instead of 50.00).
--   dscr      ≥0     — negative DSCR has no financial meaning.
--   rates     0–100  — no conceivable Non-QM product exceeds 100%.
--   term      1–480  — 1 month to 40 years; 0 or negative is nonsensical.
--   income    ≥0     — zero is valid (non-working co-borrower); negative is not.
-- =========================================================

-- LTV / CLTV ─────────────────────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_ltv   check (ltv  between 0 and 200),
  add constraint chk_loans_cltv  check (cltv between 0 and 200);

-- FICO score ──────────────────────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_fico  check (fico_score between 300 and 850);

-- Debt-to-income ──────────────────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_dti   check (debt_to_income between 0 and 150);

-- Debt service coverage ratio ─────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_dscr  check (dscr >= 0);

-- Interest rates ──────────────────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_initial_rate  check (initial_rate  between 0 and 100),
  add constraint chk_loans_interest_rate check (interest_rate between 0 and 100);

-- Loan term ───────────────────────────────────────────────────────────────────
alter table loans
  add constraint chk_loans_term  check (term_months between 1 and 480);

-- Borrower income ─────────────────────────────────────────────────────────────
alter table borrowers
  add constraint chk_borrowers_income  check (income_amount >= 0);
