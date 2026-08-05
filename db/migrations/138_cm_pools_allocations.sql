-- =========================================================
-- db/migrations/138_cm_pools_allocations.sql
--
-- Capital Markets PoC — pools + immutable allocation records.
--
--   cm_pools        — pool header (name, target close, status)
--   cm_pool_loans   — pool membership junction
--   cm_allocations  — immutable record per allocation (best_ex FK + override reason)
--
-- Per PoC §14.3 #5: "Allocation writes an immutable record (best-ex run FK
-- + any override reason) and updates pool WA stats live."
-- `cm_allocations` is therefore treated as append-only at the application
-- layer — never UPDATEd in place. To re-allocate, insert a new row with
-- status='superseded' pointing at the prior one.
--
-- Pool WA stats (weighted-average FICO/LTV/DSCR/loan_amount) are *not*
-- persisted — they're computed live from cm_pool_loans + loan_financials.
-- This keeps the pool definition simple and avoids stale denormalizations.
-- =========================================================

BEGIN;

-- ── 1. cm_pools ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cm_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  target_close    DATE,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','closed','cancelled')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cm_pools_tenant ON cm_pools (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_pools_status ON cm_pools (tenant_id, status);

DROP TRIGGER IF EXISTS trg_cm_pools_updated_at ON cm_pools;
CREATE TRIGGER trg_cm_pools_updated_at
  BEFORE UPDATE ON cm_pools
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_pools ON cm_pools;
CREATE TRIGGER trg_audit_cm_pools
  AFTER INSERT OR UPDATE OR DELETE ON cm_pools
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 2. cm_pool_loans ─────────────────────────────────────────────────────────
-- Junction table. loan_id is unique within a pool (a loan can't be in two
-- pools at once — re-pooling means removing first). pool WA stats are
-- computed by joining this to cm_allocations (for status='active') and
-- loan_financials.
CREATE TABLE IF NOT EXISTS cm_pool_loans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  pool_id         UUID NOT NULL REFERENCES cm_pools(id) ON DELETE CASCADE,
  loan_id         UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  added_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, loan_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_pool_loans_pool ON cm_pool_loans (pool_id);
CREATE INDEX IF NOT EXISTS idx_cm_pool_loans_loan ON cm_pool_loans (loan_id);

DROP TRIGGER IF EXISTS trg_audit_cm_pool_loans ON cm_pool_loans;
CREATE TRIGGER trg_audit_cm_pool_loans
  AFTER INSERT OR UPDATE OR DELETE ON cm_pool_loans
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 3. cm_allocations ────────────────────────────────────────────────────────
-- Immutable record. best_execution_run_id is the source-of-truth FK that
-- makes the audit chain reconstructable (PoC §14.3 #6). override_reason
-- captures any deviation from the system pick (margin-floor approval,
-- counterparty preference, etc.). override_actor_user_id is required
-- when override_reason is non-null — the authority-matrix hard-code
-- (PIN 2: "authority check in lock/allocation service") enforces this.
CREATE TABLE IF NOT EXISTS cm_allocations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  loan_id                 UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  pool_id                 UUID REFERENCES cm_pools(id) ON DELETE SET NULL,
  best_execution_run_id   UUID NOT NULL REFERENCES cm_best_execution_runs(id) ON DELETE RESTRICT,
  investor_program_id     UUID NOT NULL REFERENCES cm_investor_programs(id) ON DELETE RESTRICT,
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','superseded','cancelled')),
  prior_allocation_id     UUID REFERENCES cm_allocations(id) ON DELETE SET NULL,
  override_reason         TEXT,
  override_actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                   TEXT,
  allocated_by            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  allocated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_allocations_tenant ON cm_allocations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_allocations_loan ON cm_allocations (loan_id);
CREATE INDEX IF NOT EXISTS idx_cm_allocations_pool ON cm_allocations (pool_id);
CREATE INDEX IF NOT EXISTS idx_cm_allocations_run ON cm_allocations (best_execution_run_id);
-- One active allocation per loan (re-allocating supersedes the prior row)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cm_allocations_one_active_per_loan
  ON cm_allocations (tenant_id, loan_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_audit_cm_allocations ON cm_allocations;
CREATE TRIGGER trg_audit_cm_allocations
  AFTER INSERT OR UPDATE OR DELETE ON cm_allocations
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

COMMIT;
