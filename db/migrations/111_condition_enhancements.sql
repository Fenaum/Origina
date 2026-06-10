-- Migration 111: Add stage and waive_reason to conditions
-- stage: PTD (prior to docs), PTA (prior to approval), PTF (prior to funding)
-- waive_reason: documented reason required for compliance

ALTER TABLE conditions
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'prior_to_approval',
  ADD COLUMN IF NOT EXISTS waive_reason TEXT;

ALTER TABLE conditions
  ADD CONSTRAINT conditions_stage_check
    CHECK (stage IN ('prior_to_docs', 'prior_to_approval', 'prior_to_funding'));
