-- =========================================================
-- db/migrations/141_cm_domain_events.sql
--
-- Widen the domain_events.event_type CHECK constraint to include the
-- Capital Markets (CM) PoC event subset (docs/CAPITAL_MARKETS_WORKSPACE_
-- ARCHITECTURE.md §11 — CM event subset).
--
-- STANDALONE-PIN NOTE (PIN 1): per the standalone constraint, we widen
-- the EXISTING domain_events outbox (no parallel event infrastructure).
-- This is the ADR "CM Stays in the Monolith" extraction seam — outbox
-- events flow through the Sprint 4 dispatcher (event_service), and the
-- future extraction point is exactly this same table.
--
-- Events added (PoC scope per §11):
--   cm.lock.confirmed        — a lock moved from requested to confirmed
--   cm.lock.reprice_flagged  — material-change watcher flagged a confirmed lock
--   cm.lock.repriced         — reprice action issued a new priced lock
--   cm.lock.expired          — confirmed lock passed expires_at
--   cm.lock.cancelled        — lock was cancelled
--   cm.material_change       — material-change watcher detected a threshold
--                              crossing on a registered field
--   cm.eligibility_lost      — eligibility result flipped from pass to fail
--   cm.best_ex_run           — best-execution completed for a loan
--   cm.allocation_created    — allocation row inserted (system pick or override)
--
-- The existing CHECK whitelist is preserved; we only widen it. No existing
-- event_type strings change.
-- =========================================================

BEGIN;

ALTER TABLE domain_events
  DROP CONSTRAINT IF EXISTS domain_events_event_type_check;

ALTER TABLE domain_events
  ADD CONSTRAINT domain_events_event_type_check
  CHECK (event_type IN (
    -- Sprint 4 baseline
    'loan.submitted',
    'loan.status_changed',
    'condition.cleared',
    'condition.rejected',
    'document.uploaded',
    -- Sprint 7 CM PoC (added 2026-08-04)
    'cm.lock.confirmed',
    'cm.lock.reprice_flagged',
    'cm.lock.repriced',
    'cm.lock.expired',
    'cm.lock.cancelled',
    'cm.material_change',
    'cm.eligibility_lost',
    'cm.best_ex_run',
    'cm.allocation_created'
  ));

COMMIT;
