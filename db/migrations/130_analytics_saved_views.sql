-- =========================================================
-- db/migrations/130_analytics_saved_views.sql
--
-- Persistent named filter presets for the analytics dashboard.
-- Replaces URL-only filter state with durable, sharable views.
--
-- See docs/architecture/dashboard.md, Section 7 (Query Builder
-- Design) and Section 9 (Phase 4).
--
-- filter_state stores the full AnalyticsFilterRequest payload
-- (date_range, filters[], sort[], limit, page). The application
-- re-validates this JSON against the ALLOWED_FILTER_FIELDS
-- whitelist when loading a view — a stale saved view that
-- references a removed column is surfaced as "needs updating".
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS analytics_saved_views (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  created_by      UUID         NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  name            TEXT         NOT NULL,
  description     TEXT,
  filter_state    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  role_preset     TEXT,                                 -- e.g. 'underwriter', 'manager'
  is_shared       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ck_analytics_saved_views_name_len
    CHECK (char_length(name) BETWEEN 1 AND 80)
);

-- Tenant-scoped listing: "my views" + "team shared views" is the dominant pattern.
CREATE INDEX IF NOT EXISTS idx_analytics_saved_views_tenant
  ON analytics_saved_views (tenant_id, created_by);

-- Shared views across the tenant — common dashboard switch path.
CREATE INDEX IF NOT EXISTS idx_analytics_saved_views_shared
  ON analytics_saved_views (tenant_id)
  WHERE is_shared = TRUE;

-- updated_at trigger (already wired via update_updated_at_column() function
-- from migration 001 — verify it exists, otherwise add explicit trigger).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_analytics_saved_views_updated_at'
      AND tgrelid = 'analytics_saved_views'::regclass
  ) THEN
    CREATE TRIGGER trg_analytics_saved_views_updated_at
      BEFORE UPDATE ON analytics_saved_views
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Tenant isolation is enforced at the application layer via current_user.tenant_id.
-- All queries against analytics_saved_views MUST include WHERE tenant_id = :tid.

COMMENT ON TABLE  analytics_saved_views
  IS 'Named analytics filter presets — sharable within a tenant.';
COMMENT ON COLUMN analytics_saved_views.filter_state
  IS 'Full AnalyticsFilterRequest payload as JSONB. Validated on load.';
COMMENT ON COLUMN analytics_saved_views.role_preset
  IS 'Optional role preset the view was created under (manager, underwriter, etc.).';
COMMENT ON COLUMN analytics_saved_views.is_shared
  IS 'When true, visible to all users in the tenant (not just the creator).';

COMMIT;