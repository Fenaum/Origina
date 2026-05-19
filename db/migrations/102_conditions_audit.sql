-- =========================================================
-- db/migrations/102_conditions_audit.sql
--
-- Adds who/when columns for condition resolution events.
--
-- WHY: The status column already records the outcome (cleared, waived, etc.).
-- These columns record the actor and the moment of the decision — that is
-- different information. Regulators and auditors ask:
--   "Who cleared condition #4 and at what time?"
-- Without cleared_by + cleared_at, that question cannot be answered from
-- the database without an external audit log lookup.
--
-- WHY two pairs instead of one:
--   cleared  = condition was satisfied (borrower submitted the required docs).
--   waived   = condition was dropped without docs (an underwriter exception).
-- These are legally distinct outcomes. Separate columns prevent confusing
-- a doc-submission clearance with a policy waiver in reports and queries.
--
-- WHY SET NULL on delete:
--   If the user who cleared a condition is later deactivated or removed,
--   we do NOT want to lose the historical condition record. SET NULL keeps
--   the condition row intact while nullifying the user reference.
-- =========================================================

alter table conditions
  add column if not exists cleared_by uuid references users(id) on delete set null,
  add column if not exists cleared_at timestamptz,
  add column if not exists waived_by  uuid references users(id) on delete set null,
  add column if not exists waived_at  timestamptz;

-- Partial indexes: only index rows where the action occurred.
-- A partial index on (tenant_id, cleared_by) WHERE cleared_by IS NOT NULL is
-- smaller than a full index — it skips all the NULL rows (most conditions are
-- still open). This makes "show cleared conditions by user" queries faster
-- while using less storage than a full-column index.
create index if not exists idx_conditions_cleared_by
  on conditions (tenant_id, cleared_by)
  where cleared_by is not null;

create index if not exists idx_conditions_waived_by
  on conditions (tenant_id, waived_by)
  where waived_by is not null;
