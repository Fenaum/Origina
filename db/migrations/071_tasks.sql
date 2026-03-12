-- =========================================================
-- db/migrations/071_tasks.sql
-- =========================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),

  assigned_to uuid references users(id) on delete set null,
  due_at timestamptz,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on tasks (tenant_id, loan_id, status);
