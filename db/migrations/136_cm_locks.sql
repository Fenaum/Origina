-- =========================================================
-- db/migrations/136_cm_locks.sql
--
-- Capital Markets PoC — lock artifact + append-only event log.
-- Per ADR "Lock as Artifact (Not a Mutable Loan Status)":
--
--   cm_locks      — first-class artifact, immutable core terms after confirm
--   cm_lock_events — append-only lifecycle log (state transitions only)
--
-- Reproduction invariant (ADR "Reproducibility as a CI-Enforced Invariant"):
--   Every confirmed lock persists its own (loan_snapshot jsonb, snapshot_hash,
--   snapshot_versions jsonb, calc_version text). Pricing is recomputed from
--   the snapshot, NEVER from live loan data — PoC acceptance §14.3 #2.
--
-- STANDALONE-PIN NOTE (PIN 1): this table does NOT reference pricing_runs
-- or pricing_sheets (which live in unfunded migrations 132+). The
-- "funding requires an active lock" gate from the Lock-as-Artifact ADR is
-- enforced in CM's own service code for the PoC — no transition-gate
-- registry from the pricing plan is built here.
--
-- Lock lifecycle (per ADR 3):
--   requested → confirmed → (reprice_required ⇄) → extended* → expired / cancelled / funded_delivered
--
-- Relocks: a relock writes a new row chained via prior_lock_id; the prior
-- row stays in its final state for audit.
-- =========================================================

BEGIN;

-- ── 1. cm_locks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cm_locks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  rate_sheet_id       UUID NOT NULL REFERENCES cm_rate_sheets(id) ON DELETE RESTRICT,

  -- Snapshot captured at confirm time (ADR 3 reproducibility)
  loan_snapshot       JSONB NOT NULL,                       -- {fico_score, ltv, dscr, doc_type, loan_amount, property_value, program, ...}
  snapshot_hash       TEXT NOT NULL,                        -- hash of canonicalized loan_snapshot
  snapshot_versions   JSONB NOT NULL DEFAULT '{}',          -- {rate_sheet_version, llpa_versions, registry_version, ...}

  -- Priced terms (immutable after confirm)
  rate_bps            NUMERIC(6,2) NOT NULL,                -- e.g. 750 = 7.50%
  base_price          NUMERIC(12,2) NOT NULL,               -- base par price
  llpa_adjustments    JSONB NOT NULL DEFAULT '[]',          -- [{grid_code, version, value_bps, label}, ...]
  srp_bps             NUMERIC(6,2) NOT NULL DEFAULT 0,     -- servicing-released premium
  delivery_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,     -- net of fees
  adjusted_price      NUMERIC(12,2) NOT NULL,
  net_price           NUMERIC(12,2) NOT NULL,               -- base + llpa + srp - delivery_fee
  calc_version        TEXT NOT NULL,                        -- e.g. 'cm_pricing_v1'

  -- Lock terms (immutable after confirm)
  lock_period_days    INTEGER NOT NULL CHECK (lock_period_days > 0),
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,                          -- populated at confirm; null = unconfirmed
  requested_by        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  confirmed_by        UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Lifecycle
  status              TEXT NOT NULL DEFAULT 'requested'
                      CHECK (status IN (
                        'requested','confirmed','reprice_required',
                        'extended','expired','cancelled','funded_delivered'
                      )),
  reprice_required_at TIMESTAMPTZ,                          -- last time status flipped to reprice_required
  prior_lock_id       UUID REFERENCES cm_locks(id) ON DELETE SET NULL,  -- relock chain

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_locks_tenant ON cm_locks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_locks_loan ON cm_locks (loan_id);
CREATE INDEX IF NOT EXISTS idx_cm_locks_status ON cm_locks (status);
CREATE INDEX IF NOT EXISTS idx_cm_locks_expiring
  ON cm_locks (expires_at)
  WHERE status IN ('confirmed','reprice_required','extended');

-- A loan can have at most one *active* non-terminal lock at a time.
-- Multiple terminal/expiring rows are allowed (audit trail of relocks).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cm_locks_one_active_per_loan
  ON cm_locks (tenant_id, loan_id)
  WHERE status IN ('requested','confirmed','reprice_required','extended');

DROP TRIGGER IF EXISTS trg_cm_locks_updated_at ON cm_locks;
CREATE TRIGGER trg_cm_locks_updated_at
  BEFORE UPDATE ON cm_locks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_locks ON cm_locks;
CREATE TRIGGER trg_audit_cm_locks
  AFTER INSERT OR UPDATE OR DELETE ON cm_locks
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 2. cm_lock_events ────────────────────────────────────────────────────────
-- Append-only lifecycle log. event_type values are the state transitions
-- that happen *to* a lock (not the resulting status — that lives on cm_locks).
-- This table is the source of truth for "what happened to this lock, in what
-- order, with what justification." Mirrors the loan_status_events precedent.
--
-- Examples of event_type:
--   'requested'   — lock was created (request)
--   'confirmed'   — confirmed at the snapshotted price
--   'reprice_flagged' — material change detected; status flipped to reprice_required
--   'repriced'    — reprice action produced new priced terms (lock row may be replaced)
--   'extended'    — lock_period extended (PoC: hard-coded policy; Phase 3 = config)
--   'expired'     — expires_at passed; status flipped to expired
--   'cancelled'   — cancelled before confirm, or after confirm with no delivery
--   'funded_delivered' — final delivery recorded
CREATE TABLE IF NOT EXISTS cm_lock_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  lock_id         UUID NOT NULL REFERENCES cm_locks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN (
                    'requested','confirmed','reprice_flagged','repriced',
                    'extended','expired','cancelled','funded_delivered'
                  )),
  price_delta     NUMERIC(12,2),                            -- signed change vs prior price, if any
  cost            NUMERIC(12,2),                            -- cost-of-extension / reprice fees, if any
  policy_version  TEXT,                                     -- version of policy applied (e.g. 'lock_policy_v1')
  approval_id     UUID,                                     -- approval chain row id if exception used (future)
  actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}',              -- event-specific detail
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_lock_events_tenant ON cm_lock_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_lock_events_lock ON cm_lock_events (lock_id, created_at);

-- No update_at on cm_lock_events: append-only by design (AppendOnlyModel).

DROP TRIGGER IF EXISTS trg_audit_cm_lock_events ON cm_lock_events;
CREATE TRIGGER trg_audit_cm_lock_events
  AFTER INSERT OR UPDATE OR DELETE ON cm_lock_events
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

COMMIT;
