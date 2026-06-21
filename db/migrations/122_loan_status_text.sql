-- ============================================================
-- 122_loan_status_text.sql
-- Convert loans.status and loan_status_events.from_status/to_status
-- from the loan_status PostgreSQL ENUM to TEXT + CHECK constraint.
--
-- WHY:
--   PostgreSQL ENUM types cannot be modified inside a transaction
--   (ALTER TYPE ADD VALUE is DDL that commits immediately). This codebase
--   wraps every migration in a BEGIN/COMMIT, so adding workflow states
--   like suspended, uw_review, clear_to_close requires a separate out-of-
--   transaction DDL step. For a platform supporting multiple lenders with
--   custom status names, that is untenable.
--
--   TEXT + CHECK gives us:
--   - New statuses via a simple constraint update (transactional)
--   - Tenant-specific labels without schema changes
--   - Same data in the column; no row rewrites needed
-- ============================================================
BEGIN;

-- 1. loans.status ─────────────────────────────────────────────
ALTER TABLE loans
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE loans
  ALTER COLUMN status SET DEFAULT 'new_draft';

ALTER TABLE loans
  ADD CONSTRAINT ck_loan_status CHECK (
    status IN (
      'new_draft','submitted','conditions_review','approved_pending',
      'approved','funded','closed','post_closing','denied',
      'withdrawn','cancelled','archived'
    )
  );

-- 2. loan_status_events.from_status / to_status ───────────────
ALTER TABLE loan_status_events
  ALTER COLUMN from_status TYPE text USING from_status::text;

ALTER TABLE loan_status_events
  ALTER COLUMN to_status TYPE text USING to_status::text;

ALTER TABLE loan_status_events
  ADD CONSTRAINT ck_loan_status_event_from CHECK (
    from_status IS NULL OR from_status IN (
      'new_draft','submitted','conditions_review','approved_pending',
      'approved','funded','closed','post_closing','denied',
      'withdrawn','cancelled','archived'
    )
  );

ALTER TABLE loan_status_events
  ADD CONSTRAINT ck_loan_status_event_to CHECK (
    to_status IN (
      'new_draft','submitted','conditions_review','approved_pending',
      'approved','funded','closed','post_closing','denied',
      'withdrawn','cancelled','archived'
    )
  );

COMMIT;
