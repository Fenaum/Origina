-- db/00_all.sql
-- Convenience file for running the full schema via psql in one command:
--   psql $DATABASE_URL -f db/00_all.sql
--
-- For application startup use scripts/init_db.py instead — it tracks
-- which migrations have been applied and skips already-applied files.
\set ON_ERROR_STOP on
\set client_min_messages warning

\ir migrations/001_extensions.sql
\ir migrations/010_tenants.sql
\ir migrations/020_users_rbac.sql
\ir migrations/030_types.sql
\ir migrations/040_parties.sql
\ir migrations/041_user_parties.sql
\ir migrations/050_loans.sql
\ir migrations/055_conditions.sql
\ir migrations/060_properties.sql
\ir migrations/070_exceptions.sql
\ir migrations/071_tasks.sql
\ir migrations/072_notes.sql
\ir migrations/073_loan_status_events.sql
\ir migrations/080_documents.sql
\ir migrations/090_decisioning.sql
\ir migrations/100_audit_snapshots.sql
\ir migrations/101_borrowers.sql

-- Optimizations applied after initial schema (run after the base tables exist)
\ir migrations/102_conditions_audit.sql
\ir migrations/103_check_constraints.sql
\ir migrations/104_address_cleanup_trigger.sql

-- Dev/local seed data — never run in staging or production
\ir migrations/003_seed.sql
