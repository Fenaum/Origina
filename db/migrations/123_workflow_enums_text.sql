-- ============================================================
-- 123_workflow_enums_text.sql
-- Convert condition_status, task_status, task_priority from
-- PostgreSQL ENUM to TEXT + CHECK.
--
-- Same rationale as 122: transaction-safe evolution without
-- ALTER TYPE ADD VALUE. Investor-specific condition statuses
-- (e.g. "pended", "suspended") and tenant-specific task priority
-- labels become simple CHECK updates rather than out-of-transaction
-- DDL operations.
-- ============================================================
BEGIN;

-- 1. conditions.status ────────────────────────────────────────
ALTER TABLE conditions
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE conditions
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE conditions
  ADD CONSTRAINT ck_condition_status CHECK (
    status IN ('open','submitted','cleared','waived','rejected')
  );

-- 2. tasks.status ─────────────────────────────────────────────
ALTER TABLE tasks
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE tasks
  ALTER COLUMN status SET DEFAULT 'todo';

ALTER TABLE tasks
  ADD CONSTRAINT ck_task_status CHECK (
    status IN ('todo','in_progress','blocked','done','cancelled')
  );

-- 3. tasks.priority ───────────────────────────────────────────
ALTER TABLE tasks
  ALTER COLUMN priority TYPE text USING priority::text;

ALTER TABLE tasks
  ALTER COLUMN priority SET DEFAULT 'normal';

ALTER TABLE tasks
  ADD CONSTRAINT ck_task_priority CHECK (
    priority IN ('low','normal','high','urgent')
  );

COMMIT;
