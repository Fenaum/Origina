-- =========================================================
-- db/migrations/137_cm_eligibility_best_ex.sql
--
-- Capital Markets PoC — eligibility evaluation evidence + best-execution runs.
-- Both tables are append-only (one row per evaluation) — no UPDATE in place.
--
--   cm_eligibility_results   — pass/fail of a (loan, program) pair at a snapshot
--   cm_best_execution_runs  — ranked exit table for a loan at a snapshot
--
-- Per ADR "Reproducibility as a CI-Enforced Invariant":
--   Every run persists (loan_snapshot_hash, snapshot_versions, calc_version)
--   so it can be replayed from the snapshot, not from live loan data.
--
-- Per ADR "Investor Overlays via Shadowing":
--   The rule trace on cm_eligibility_results records both base rule
--   outcomes and overlay rule outcomes — replay includes overlay version.
--
-- Per ADR "Calculation Ownership Map":
--   Eligibility and best-ex are CMS-owned calcs. Their persisted result
--   is the single source of truth — UI reads from these tables, never
--   recomputes.
-- =========================================================

BEGIN;

-- ── 1. cm_eligibility_results ────────────────────────────────────────────────
-- One row per (loan, program) evaluation. Re-evaluations produce new rows;
-- the prior row is preserved for audit.
CREATE TABLE IF NOT EXISTS cm_eligibility_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  investor_program_id UUID NOT NULL REFERENCES cm_investor_programs(id) ON DELETE CASCADE,

  -- Reproduction fields (ADR 8)
  loan_snapshot_hash  TEXT NOT NULL,
  snapshot_versions   JSONB NOT NULL DEFAULT '{}',        -- {guideline_version, overlay_version, llpa_versions, ...}
  calc_version        TEXT NOT NULL,                       -- 'cm_eligibility_v1'

  -- Outcome
  passed             BOOLEAN NOT NULL,
  failing_rules      JSONB NOT NULL DEFAULT '[]',          -- [{rule_code, op, value, observed, severity}, ...]
  rule_trace         JSONB NOT NULL DEFAULT '[]',          -- ordered base-then-overlay trace, both passes and fails
  evaluated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_eligibility_results_tenant
  ON cm_eligibility_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_eligibility_results_loan
  ON cm_eligibility_results (loan_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_eligibility_results_program
  ON cm_eligibility_results (investor_program_id, evaluated_at DESC);

DROP TRIGGER IF EXISTS trg_audit_cm_eligibility_results ON cm_eligibility_results;
CREATE TRIGGER trg_audit_cm_eligibility_results
  AFTER INSERT OR UPDATE OR DELETE ON cm_eligibility_results
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 2. cm_best_execution_runs ────────────────────────────────────────────────
-- One row per best-ex run on a loan. ranked_results is the full ranked table
-- (investor + adjusted net + breakdown) so the run is replayable end-to-end.
-- chosen_investor_program_id is the system pick; allocation may override.
--
-- Best-ex net formula (PoC §14.1): investor base + investor LLPAs + SRP - delivery fee
-- Persisted alongside so auditors can see exactly which inputs produced the ranking.
CREATE TABLE IF NOT EXISTS cm_best_execution_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

  -- Reproduction fields (ADR 8)
  loan_snapshot_hash  TEXT NOT NULL,
  loan_snapshot       JSONB NOT NULL,                       -- captured at run time for full replay
  rate_sheet_id       UUID NOT NULL REFERENCES cm_rate_sheets(id) ON DELETE RESTRICT,
  snapshot_versions   JSONB NOT NULL DEFAULT '{}',          -- {rate_sheet_version, llpa_versions, registry_version, investor_program_versions, overlay_versions}
  calc_version        TEXT NOT NULL,                        -- 'cm_best_ex_v1'

  -- Inputs summary (for fast filtering without parsing loan_snapshot)
  product_code        TEXT NOT NULL,
  lock_period_days    INTEGER NOT NULL,
  rate_bps            NUMERIC(6,2) NOT NULL,

  -- Ranked table — full list, ordered best→worst by net_proceeds desc
  ranked_results      JSONB NOT NULL,
  -- [
  --   {rank: 1, investor_program_id: '...', net_proceeds: 100500.00, llpa_total_bps: -25,
  --    srp_bps: 100, delivery_fee: 350, breakdown: [...], tie_break_key: 'investor_id_asc'},
  --   ...
  -- ]

  -- System pick — the top-ranked investor program
  chosen_investor_program_id UUID REFERENCES cm_investor_programs(id) ON DELETE SET NULL,
  variance_to_second  NUMERIC(12,2),                        -- chosen - second, for transparency
  rationale           TEXT,                                 -- human-readable explanation (for the audit view)

  evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_best_execution_runs_tenant
  ON cm_best_execution_runs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_best_execution_runs_loan
  ON cm_best_execution_runs (loan_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_best_execution_runs_chosen
  ON cm_best_execution_runs (chosen_investor_program_id);

DROP TRIGGER IF EXISTS trg_audit_cm_best_execution_runs ON cm_best_execution_runs;
CREATE TRIGGER trg_audit_cm_best_execution_runs
  AFTER INSERT OR UPDATE OR DELETE ON cm_best_execution_runs
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

COMMIT;
