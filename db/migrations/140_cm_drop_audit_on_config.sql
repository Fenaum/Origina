-- =========================================================
-- db/migrations/140_cm_drop_audit_on_config.sql
--
-- Drop audit triggers from cm_material_change_registry and cm_investor_overlays.
--
-- WHY: Both tables follow ADR 4 (Material-Change Registry) and ADR 5
-- (Investor Overlays via Shadowing), which explicitly allow
-- `tenant_id IS NULL` rows as SYSTEM defaults. The `log_audit_event()`
-- function (105_audit_triggers.sql + 109_fix_audit_trigger.sql) reads
-- `tenant_id` from new/old and writes it to audit_log, which has a
-- NOT NULL constraint on tenant_id — so a system-default row crashes
-- the trigger.
--
-- Config tables (controlled_values, cm_material_change_registry,
-- cm_investor_overlays) do not need per-row audit:
--   • Their edits go through a versioned-config workflow, so the version
--     column itself is the audit ("as of version N, X was the rule").
--   • The per-decision `snapshot_versions` jsonb on every lock / best-ex
--     / eligibility run records which config version produced each
--     decision — that's the audit trail for what the rules WERE.
--   • Per-row audit on tenant-shared config would generate noise without
--     regulatory value (no borrower PII, no per-loan state change).
--
-- This is a PoC fix. Phase 3 may add a separate audit_log_config table
-- if the workflow needs it.
-- =========================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_audit_cm_material_change_registry ON cm_material_change_registry;
DROP TRIGGER IF EXISTS trg_audit_cm_investor_overlays ON cm_investor_overlays;

COMMIT;
