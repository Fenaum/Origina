-- =========================================================
-- Conditions Table Migration
-- =========================================================

-- Loan conditions tied to a single loan; deletes cascade with the loan.
create table if not exists conditions (
    id uuid primary key default gen_random_uuid(),
    loan_id uuid not null references loans(id) on delete cascade,
    name text not null,
    description text,
    condition_number integer not null,
    status condition_status not null default 'open',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Quick lookup by condition name.
create index if not exists idx_conditions_name on conditions (name);

-- Make the updated_at trigger idempotent for re-runs.
drop trigger if exists update_conditions_updated_at on conditions;
-- Keep updated_at current on every row update.
create trigger update_conditions_updated_at
before update on conditions
for each row
execute procedure update_updated_at_column();
-- =========================================================
