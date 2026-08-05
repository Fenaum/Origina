-- =========================================================
-- db/migrations/142_domain_events_created_at.sql
--
-- Add created_at column to domain_events to match the AppendOnlyModel
-- contract used by app.models.events.DomainEvent. The original Sprint 4
-- migration 131 omitted created_at on this table, leaving the ORM model
-- referencing a column that did not exist. INSERT ... RETURNING created_at
-- failed when the CM watcher first emitted a CM event (no existing suite
-- exercises this path, so the bug went undetected until Sprint 7 / CM PoC).
--
-- STANDALONE-PIN NOTE (PIN 1): this migration is a schema-repair change
-- to shared infrastructure (domain_events outbox), NOT a CM feature. CM
-- inherits a now-consistent schema; no CM table is created here.
--
-- The column is NOT NULL with default now() — identical semantics to the
-- AppendOnlyModel created_at mixin. No existing rows are affected because
-- the column did not exist; this is purely additive. No data backfill
-- needed because occurred_at already exists and is set to now() at insert.
-- =========================================================

BEGIN;

ALTER TABLE domain_events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMIT;
