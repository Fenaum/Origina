-- =========================================================
-- db/migrations/080_documents.sql
-- =========================================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  doc_type text, -- 'bank_statement','id','paystub','purchase_contract', etc.
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  storage_key text not null, -- e.g., S3 key
  sha256 text, -- integrity / dedupe

  uploaded_by uuid references users(id) on delete set null,
  uploaded_at timestamptz not null default now(),

  tags jsonb not null default '{}'::jsonb
);

create index if not exists idx_documents_loan on documents (tenant_id, loan_id, uploaded_at desc);
create index if not exists idx_documents_sha on documents (tenant_id, sha256);
