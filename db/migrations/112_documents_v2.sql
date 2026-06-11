-- =========================================================
-- db/migrations/112_documents_v2.sql
--
-- Adds soft-delete and condition-linking columns to the
-- documents table introduced in 080_documents.sql.
--
-- archived_at / archived_by: soft-delete fields. A document
--   with archived_at IS NOT NULL is logically deleted but
--   retained for audit purposes. Hard DELETE is not used.
--
-- condition_id: optional FK linking a document to a specific
--   loan condition. Used by the document checklist to associate
--   uploads with outstanding conditions.
-- =========================================================

alter table documents
  add column if not exists archived_at   timestamptz,
  add column if not exists archived_by   uuid references users(id) on delete set null,
  add column if not exists condition_id  uuid references conditions(id) on delete set null;

-- Partial index — active documents only (excludes archived rows).
-- The API's default list query uses this to avoid full table scans
-- when include_archived=false (the common case).
create index if not exists idx_documents_active
  on documents (tenant_id, loan_id, uploaded_at desc)
  where archived_at is null;

-- Condition-scoped lookup — used by the document checklist to fetch
-- documents attached to a specific condition.
create index if not exists idx_documents_condition
  on documents (tenant_id, condition_id)
  where condition_id is not null;
