-- =========================================================
-- db/migrations/055_conditions.sql
-- Loan conditions tied to a single loan; deletes cascade with the loan.
-- Moved from 002 → 055 so it runs after loans (050) and enums (030).
-- =========================================================

create table if not exists conditions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete restrict,
    loan_id uuid not null references loans(id) on delete cascade,
    name text not null,
    description text,
    condition_number integer not null,
    status condition_status not null default 'open',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_conditions_tenant_loan on conditions (tenant_id, loan_id);
create index if not exists idx_conditions_name on conditions (name);

drop trigger if exists update_conditions_updated_at on conditions;
create trigger update_conditions_updated_at
before update on conditions
for each row
execute procedure update_updated_at_column();
