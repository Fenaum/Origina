-- =========================================================
-- db/migrations/131_domain_events.sql
--
-- Sprint 4 §4.4 — transactional outbox for cross-cutting consumers
-- (notifications now; webhooks, AI triggers, SLA timers later).
--
-- Why a separate table:
--   An event exists if and only if the originating state change committed.
--   Writing the event row in the same transaction as the state change
--   gives us atomicity without two-phase commit. The dispatcher polls
--   for unprocessed rows; consumers must be idempotent (at-least-once).
--
-- Adding a new event_type later:
--   Widen the CHECK constraint in a new migration, mirroring every other
--   TEXT+CHECK column in this schema. The dispatcher reads `event_type` as
--   a plain string, so adding types never requires a schema migration on
--   the events table itself beyond the whitelist.
-- =========================================================

CREATE TABLE IF NOT EXISTS domain_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    event_type    TEXT NOT NULL CHECK (event_type IN (
        'loan.submitted',
        'loan.status_changed',
        'condition.cleared',
        'condition.rejected',
        'document.uploaded'
    )),
    entity_type   TEXT NOT NULL,
    entity_id     UUID NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ
);

-- Dispatcher polls for unprocessed events. A partial index keeps the
-- working set small even as the table grows.
CREATE INDEX IF NOT EXISTS idx_domain_events_unprocessed
    ON domain_events (occurred_at)
    WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_entity
    ON domain_events (tenant_id, entity_type, entity_id);
