-- =========================================================
-- db/migrations/119_exceptions_stabilize.sql
--
-- Phase 1: Stabilize exception status and severity storage.
--
-- Problem:
--   exceptions.status uses the exception_status PostgreSQL ENUM
--   (defined in 030_types.sql). PostgreSQL requires ALTER TYPE
--   ADD VALUE to run outside a transaction. The migration runner
--   wraps every file in its own transaction, so extending the
--   ENUM with new workflow states is not possible without
--   either breaking the runner or using a workaround.
--
-- Solution:
--   Convert both status and severity from PostgreSQL ENUM to
--   TEXT with CHECK constraints. TEXT + CHECK gives identical
--   runtime enforcement while allowing any future migration to
--   add or rename values with a simple DROP + ADD CONSTRAINT,
--   both of which run safely inside a transaction.
--
-- Compatibility:
--   - Uses ALTER COLUMN TYPE (runs in transaction). Safe.
--   - Does NOT use ALTER TYPE ADD VALUE (cannot run in transaction).
--   - DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT is idempotent.
--   - Existing data ('open', 'approved', 'denied', 'withdrawn',
--     'closed') is preserved without transformation via the
--     USING status::text cast.
--   - The exception_status and exception_severity PostgreSQL ENUM
--     types are left in place as orphaned types — they are no
--     longer referenced by any column and will not cause errors.
-- =========================================================

-- ── 1. Convert exceptions.status: ENUM → TEXT ────────────────────────────────
-- The USING clause casts each enum value to its text representation.
-- All existing values are preserved exactly as stored.
alter table exceptions
  alter column status type text using status::text;

-- ── 2. CHECK constraint for status ───────────────────────────────────────────
-- Preserves all five legacy values and adds new workflow states.
-- DROP first so this migration is safe to re-run (idempotent).
alter table exceptions drop constraint if exists ck_exception_status;
alter table exceptions
  add constraint ck_exception_status check (status in (
    'open',                       -- legacy: pre-workflow-state exceptions
    'draft',                      -- created, not yet submitted for review
    'submitted',                  -- submitted to the approver queue
    'assigned',                   -- assigned to a specific approver
    'under_review',               -- approver is actively reviewing
    'additional_info_requested',  -- approver requested more information
    'approved',                   -- approved as requested
    'approved_with_conditions',   -- approved with restrictions imposed
    'denied',                     -- denied
    'withdrawn',                  -- requester withdrew the request
    'closed'                      -- legacy: closed after all conditions satisfied
  ));

-- ── 3. Convert exceptions.severity: ENUM → TEXT ──────────────────────────────
-- Same rationale: ENUM immutability is a liability. If a future product
-- requirement adds 'informational' or 'catastrophic' severity, this
-- column can be extended with a simple constraint swap.
alter table exceptions
  alter column severity type text using severity::text;

-- ── 4. CHECK constraint for severity ─────────────────────────────────────────
alter table exceptions drop constraint if exists ck_exception_severity;
alter table exceptions
  add constraint ck_exception_severity check (
    severity in ('low', 'medium', 'high', 'critical')
  );
