-- =========================================================
-- db/migrations/139_cm_alerts_config.sql
--
-- Capital Markets PoC — per-loan alerts + audit-version config.
--
--   cm_alerts          — in-app alert list (PoC §14.1: "Notification
--                        fan-out = in-app list only"). Raised by the
--                        material-change watcher, the eligibility
--                        evaluator, the margin-floor check, etc.
--   cm_audit_versions  — singleton config tracking the active
--                        versions of every CM config artifact (the
--                        human-readable companion to the per-decision
--                        snapshot_versions jsonb — ADR 8).
--
-- Alert fan-out is deliberately out of scope for the PoC — the dispatcher
-- pattern from Sprint 4 (`domain_events`) already exists and the alert
-- consumer can be added without schema changes here.
-- =========================================================

BEGIN;

-- ── 1. cm_alerts ─────────────────────────────────────────────────────────────
-- One row per alert raised. Lifecycle: open → acknowledged → resolved/dismissed.
-- related_entity_type/entity_id is a polymorphic pointer to the CM artifact
-- the alert is about (lock, allocation, eligibility_result, ...).
--
-- severity: 'info' | 'warn' | 'block' — mirrors the material-change registry
-- severity vocabulary so the UI can render consistently.
CREATE TABLE IF NOT EXISTS cm_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  loan_id               UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

  alert_type            TEXT NOT NULL
                        CHECK (alert_type IN (
                          'reprice_required',     -- material change on a confirmed lock
                          'eligibility_lost',     -- eligibility flip from pass to fail
                          'below_margin_floor',   -- best-ex net below tenant floor
                          'lock_expired',         -- confirmed lock past expires_at
                          'allocation_override'   -- allocation deviated from system pick
                        )),
  severity              TEXT NOT NULL
                        CHECK (severity IN ('info','warn','block')),
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  message               TEXT NOT NULL,
  related_entity_type   TEXT,                                -- 'cm_lock','cm_allocation','cm_eligibility_result',...
  related_entity_id     UUID,
  raised_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  raised_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  payload               JSONB NOT NULL DEFAULT '{}',         -- event-specific detail (failing rule, deltas, ...)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_alerts_tenant ON cm_alerts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_alerts_loan ON cm_alerts (loan_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_alerts_open
  ON cm_alerts (tenant_id, status, raised_at DESC)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_cm_alerts_type
  ON cm_alerts (tenant_id, alert_type, raised_at DESC);

DROP TRIGGER IF EXISTS trg_cm_alerts_updated_at ON cm_alerts;
CREATE TRIGGER trg_cm_alerts_updated_at
  BEFORE UPDATE ON cm_alerts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_alerts ON cm_alerts;
CREATE TRIGGER trg_audit_cm_alerts
  AFTER INSERT OR UPDATE OR DELETE ON cm_alerts
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 2. cm_audit_versions ─────────────────────────────────────────────────────
-- Singleton config tracking the active versions of every CM config artifact.
-- A row is keyed by config_code (e.g. 'material_change_registry',
-- 'rate_sheet_origina', 'llpa_fico_ltv'); the version column is the version
-- of that config that the system currently treats as authoritative.
--
-- Per ADR 8, every CMS calc persists its own snapshot_versions jsonb. This
-- table is the human-readable companion — auditors can see "as of date X,
-- the system was operating under rate_sheet version 3, LLPA FICO×LTV grid
-- version 2, ...".
CREATE TABLE IF NOT EXISTS cm_audit_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  config_code     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to    TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, config_code, version)
);

CREATE INDEX IF NOT EXISTS idx_cm_audit_versions_tenant
  ON cm_audit_versions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_audit_versions_active
  ON cm_audit_versions (tenant_id, config_code)
  WHERE effective_to IS NULL;

DROP TRIGGER IF EXISTS trg_cm_audit_versions_updated_at ON cm_audit_versions;
CREATE TRIGGER trg_cm_audit_versions_updated_at
  BEFORE UPDATE ON cm_audit_versions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_audit_versions ON cm_audit_versions;
CREATE TRIGGER trg_audit_cm_audit_versions
  AFTER INSERT OR UPDATE OR DELETE ON cm_audit_versions
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

COMMIT;
