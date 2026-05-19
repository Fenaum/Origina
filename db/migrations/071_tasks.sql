-- =========================================================
-- db/migrations/071_tasks.sql
-- =========================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'normal',

  assigned_to uuid references users(id) on delete set null,
  due_at timestamptz,

  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on tasks (tenant_id, loan_id, status);

drop trigger if exists update_tasks_updated_at on tasks;
create trigger update_tasks_updated_at
before update on tasks
for each row
execute procedure update_updated_at_column();
