-- =========================================================
-- db/migrations/020_users_rbac.sql
-- =========================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  email text not null,
  full_name text,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

drop trigger if exists update_users_updated_at on users;
create trigger update_users_updated_at
before update on users
for each row
execute procedure update_updated_at_column();

create table if not exists user_roles (
  tenant_id uuid not null references tenants(id) on delete restrict,
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, role_id)
);
