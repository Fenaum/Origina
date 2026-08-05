-- =========================================================
-- db/migrations/135_cm_foundation.sql
--
-- Capital Markets (CM) PoC — foundation migration.
-- Adds the seed/lookup/config tables for the off-sprint PoC
-- (docs/CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §14):
--
--   cm_investors            — counterparty master
--   cm_investor_programs    — buyable programs per investor
--   cm_investor_overlays    — overlay rules that shadow base guidelines (ADR 5)
--   cm_rate_sheets          — published Origina pricing artifact (versioned)
--   cm_rate_sheet_entries   — grid rows, frozen with the sheet
--   cm_llpa_grids           — LLPA matrix metadata (FICO×LTV, DSCR band, doc type)
--   cm_llpa_cells           — cells of the grid, frozen with the grid version
--   cm_material_change_registry — versioned field→impact config (ADR 4)
--
-- House rules (CLAUDE.md):
--   • TEXT + CHECK for every status/type column (no ENUMs)
--   • tenant_id on every table; mutating tables get log_audit_event() trigger
--   • PKs all use `id` — _LOAN_ID_PK array in the audit trigger is untouched
--   • No FK to pricing-plan tables (132–134) — CM is standalone per the
--     PIN 1 constraint on this milestone (ADR "Reproducibility as a
--     CI-Enforced Invariant" persistence lives on each CM artifact itself)
--
-- This migration also inserts the `capital_markets` role for the
-- origina-dev tenant (PIN 2). Roles for other tenants are inserted on
-- tenant creation — see Sprint 5 onboarding flow.
-- =========================================================

BEGIN;

-- ── 1. cm_investors ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cm_investors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  contact_email TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','offboarded')),
  delivery_spec JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cm_investors_tenant ON cm_investors (tenant_id);

DROP TRIGGER IF EXISTS trg_cm_investors_updated_at ON cm_investors;
CREATE TRIGGER trg_cm_investors_updated_at
  BEFORE UPDATE ON cm_investors
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_investors ON cm_investors;
CREATE TRIGGER trg_audit_cm_investors
  AFTER INSERT OR UPDATE OR DELETE ON cm_investors
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 2. cm_investor_programs ──────────────────────────────────────────────────
-- A program is a buyable product shape (e.g. "DSCR 30yr fixed, FICO 680+, LTV ≤ 75").
-- Versioned via (investor_id, product_code, version); the active row per
-- (investor, product) is the one whose effective window covers "now".
CREATE TABLE IF NOT EXISTS cm_investor_programs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  investor_id        UUID NOT NULL REFERENCES cm_investors(id) ON DELETE CASCADE,
  product_code       TEXT NOT NULL,                       -- 'dscr_30_fixed', 'bank_stmt_30_fixed', ...
  guideline_version  TEXT NOT NULL,                       -- versioned base guideline ref
  overlay_version    TEXT NOT NULL,                       -- versioned overlay set ref (ADR 5)
  srp_schedule       JSONB NOT NULL DEFAULT '{}',         -- SRP bps by lock period / LTV band
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','paused','retired')),
  effective_from     DATE NOT NULL,
  effective_to       DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, investor_id, product_code, guideline_version)
);

CREATE INDEX IF NOT EXISTS idx_cm_investor_programs_tenant
  ON cm_investor_programs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_investor_programs_investor
  ON cm_investor_programs (investor_id);

DROP TRIGGER IF EXISTS trg_cm_investor_programs_updated_at ON cm_investor_programs;
CREATE TRIGGER trg_cm_investor_programs_updated_at
  BEFORE UPDATE ON cm_investor_programs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_investor_programs ON cm_investor_programs;
CREATE TRIGGER trg_audit_cm_investor_programs
  AFTER INSERT OR UPDATE OR DELETE ON cm_investor_programs
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 3. cm_investor_overlays ──────────────────────────────────────────────────
-- Per ADR 5: overlay rows shadow base guidelines using the same idiom as
-- controlled_values. tenant_id IS NULL = system default overlay for the
-- (investor_id, program_version, rule_code) tuple; tenant_id = X = tenant
-- override that shadows at evaluation time.
--
-- Each row is one rule delta: e.g. {rule_code: 'max_ltv', op: '<=', value: 70}.
-- Multiple rows per program stack; evaluation is base-then-overlay in declared order.
CREATE TABLE IF NOT EXISTS cm_investor_overlays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE RESTRICT,   -- nullable: NULL = system
  investor_id   UUID NOT NULL REFERENCES cm_investors(id) ON DELETE CASCADE,
  program_version TEXT NOT NULL,                                  -- matches cm_investor_programs.guideline_version or overlay_version
  rule_code     TEXT NOT NULL,                                    -- 'max_ltv','min_fico','min_dscr','max_dti','min_reserves_months',...
  op            TEXT NOT NULL CHECK (op IN ('<=','<','=','>','>=','in','not_in')),
  value         JSONB NOT NULL,                                   -- numeric or array depending on op
  severity      TEXT NOT NULL DEFAULT 'block'
                CHECK (severity IN ('block','warn')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_investor_overlays_tenant
  ON cm_investor_overlays (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_investor_overlays_lookup
  ON cm_investor_overlays (investor_id, program_version, rule_code);

DROP TRIGGER IF EXISTS trg_cm_investor_overlays_updated_at ON cm_investor_overlays;
CREATE TRIGGER trg_cm_investor_overlays_updated_at
  BEFORE UPDATE ON cm_investor_overlays
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_investor_overlays ON cm_investor_overlays;
CREATE TRIGGER trg_audit_cm_investor_overlays
  AFTER INSERT OR UPDATE OR DELETE ON cm_investor_overlays
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 4. cm_rate_sheets ────────────────────────────────────────────────────────
-- Origina's published pricing artifact. Same idiom as pricing_sheets
-- (PRICING_DECISION_FUNDING_PLAN.md §3): version monotone per channel,
-- immutable once published, supersession chain via supersedes_id.
--
-- STANDALONE-PIN NOTE (PIN 1): this table does NOT reference pricing_sheets
-- (which is in the unfunded 132 migration). It implements the snapshot/hash/
-- supersession idiom independently. The pricing plan and CM plan converge
-- on this design pattern but ship independently.
CREATE TABLE IF NOT EXISTS cm_rate_sheets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  channel         TEXT NOT NULL CHECK (channel IN ('origina','broker','tpo')),
  version         INTEGER NOT NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending_approval','published','superseded','withdrawn')),
  published_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ,
  source_note     TEXT,                                          -- human-readable provenance
  supersedes_id   UUID REFERENCES cm_rate_sheets(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, version)
);

CREATE INDEX IF NOT EXISTS idx_cm_rate_sheets_tenant
  ON cm_rate_sheets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_rate_sheets_active
  ON cm_rate_sheets (tenant_id, channel, effective_from)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS trg_cm_rate_sheets_updated_at ON cm_rate_sheets;
CREATE TRIGGER trg_cm_rate_sheets_updated_at
  BEFORE UPDATE ON cm_rate_sheets
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_rate_sheets ON cm_rate_sheets;
CREATE TRIGGER trg_audit_cm_rate_sheets
  AFTER INSERT OR UPDATE OR DELETE ON cm_rate_sheets
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 5. cm_rate_sheet_entries ─────────────────────────────────────────────────
-- Grid rows frozen with the sheet version. product_code + lock_period_days
-- + loan_amount_band map to (rate_bps, points). Lookup at pricing time is
-- the entry closest above the requested lock period, in the requested band.
CREATE TABLE IF NOT EXISTS cm_rate_sheet_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  rate_sheet_id       UUID NOT NULL REFERENCES cm_rate_sheets(id) ON DELETE CASCADE,
  product_code        TEXT NOT NULL,
  lock_period_days    INTEGER NOT NULL CHECK (lock_period_days > 0),
  loan_amount_min     NUMERIC(14,2) NOT NULL,
  loan_amount_max     NUMERIC(14,2) NOT NULL,
  rate_bps            NUMERIC(6,2) NOT NULL,        -- e.g. 750 = 7.50%
  points              NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (loan_amount_max >= loan_amount_min)
);

CREATE INDEX IF NOT EXISTS idx_cm_rate_sheet_entries_sheet
  ON cm_rate_sheet_entries (rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_cm_rate_sheet_entries_lookup
  ON cm_rate_sheet_entries (tenant_id, product_code, lock_period_days, loan_amount_min);

DROP TRIGGER IF EXISTS trg_audit_cm_rate_sheet_entries ON cm_rate_sheet_entries;
CREATE TRIGGER trg_audit_cm_rate_sheet_entries
  AFTER INSERT OR UPDATE OR DELETE ON cm_rate_sheet_entries
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 6. cm_llpa_grids ─────────────────────────────────────────────────────────
-- Adjustment matrix metadata. dimension_spec is a jsonb describing which
-- axes the cells live on (e.g. ['fico_band','ltv_band']). Versioned per
-- (grid_code, version); frozen with version. Referenced by rate_sheet
-- version via the snapshot_versions jsonb on a lock.
CREATE TABLE IF NOT EXISTS cm_llpa_grids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  grid_code       TEXT NOT NULL,                       -- 'fico_ltv','dscr_band','doc_type'
  version         INTEGER NOT NULL,
  dimension_spec  JSONB NOT NULL,                      -- {axes: [...], bands: {...}}
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, grid_code, version)
);

CREATE INDEX IF NOT EXISTS idx_cm_llpa_grids_tenant
  ON cm_llpa_grids (tenant_id);

DROP TRIGGER IF EXISTS trg_cm_llpa_grids_updated_at ON cm_llpa_grids;
CREATE TRIGGER trg_cm_llpa_grids_updated_at
  BEFORE UPDATE ON cm_llpa_grids
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_llpa_grids ON cm_llpa_grids;
CREATE TRIGGER trg_audit_cm_llpa_grids
  AFTER INSERT OR UPDATE OR DELETE ON cm_llpa_grids
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 7. cm_llpa_cells ─────────────────────────────────────────────────────────
-- Cells of an LLPA grid. Frozen with the grid version. value_bps is signed
-- (positive = debit, negative = credit); lookup keys are the axis values.
CREATE TABLE IF NOT EXISTS cm_llpa_cells (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  llpa_grid_id    UUID NOT NULL REFERENCES cm_llpa_grids(id) ON DELETE CASCADE,
  product_code    TEXT NOT NULL,
  axis_values     JSONB NOT NULL,                      -- {"fico_band":"660-679","ltv_band":"70-75"}
  value_bps       NUMERIC(6,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_llpa_cells_grid
  ON cm_llpa_cells (llpa_grid_id);
CREATE INDEX IF NOT EXISTS idx_cm_llpa_cells_lookup
  ON cm_llpa_cells (tenant_id, product_code);

DROP TRIGGER IF EXISTS trg_audit_cm_llpa_cells ON cm_llpa_cells;
CREATE TRIGGER trg_audit_cm_llpa_cells
  AFTER INSERT OR UPDATE OR DELETE ON cm_llpa_cells
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 8. cm_material_change_registry ───────────────────────────────────────────
-- Per ADR 4: versioned field→impact config. Each row is one (field, impact)
-- mapping with a tolerance band and a severity. tenant_id IS NULL = system
-- default; tenant_id = X = tenant override (reuses the controlled_values
-- shadowing pattern).
--
-- impact values:
--   'rate'           — changes the rate row picked from the sheet
--   'price'          — changes the LLPA / SRP / price components
--   'eligibility'    — changes which investor programs accept the loan
--   'best_ex_rank'   — changes the ordering of best-ex results
--
-- tolerance is a jsonb shape; common form: {op: '>=', delta: 25} meaning
-- the field must change by ≥ delta before it crosses the threshold.
CREATE TABLE IF NOT EXISTS cm_material_change_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE RESTRICT,   -- nullable: NULL = system
  field_name      TEXT NOT NULL,                       -- 'fico_score','ltv','dscr','loan_amount','doc_type',...
  impact          TEXT NOT NULL
                  CHECK (impact IN ('rate','price','eligibility','best_ex_rank')),
  tolerance       JSONB NOT NULL,                      -- documented per-impact shape
  severity        TEXT NOT NULL DEFAULT 'warn'
                  CHECK (severity IN ('warn','block')),
  version         INTEGER NOT NULL,                    -- monotone per (tenant_id, field_name)
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_material_change_registry_tenant
  ON cm_material_change_registry (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cm_material_change_registry_field
  ON cm_material_change_registry (field_name);

DROP TRIGGER IF EXISTS trg_cm_material_change_registry_updated_at ON cm_material_change_registry;
CREATE TRIGGER trg_cm_material_change_registry_updated_at
  BEFORE UPDATE ON cm_material_change_registry
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_cm_material_change_registry ON cm_material_change_registry;
CREATE TRIGGER trg_audit_cm_material_change_registry
  AFTER INSERT OR UPDATE OR DELETE ON cm_material_change_registry
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();


-- ── 9. Insert the capital_markets role (PIN 2) ───────────────────────────────
-- Insert into every existing tenant's roles. Idempotent via UNIQUE (tenant_id,name).
INSERT INTO roles (tenant_id, name, description)
SELECT t.id, 'capital_markets', 'Capital Markets — locks, pricing, best-execution, allocation'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.name = 'capital_markets'
);

COMMIT;
