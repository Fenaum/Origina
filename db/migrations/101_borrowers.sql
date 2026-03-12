-- ==================
-- NOTE: fixed enum syntax (values must be quoted, no trailing comma)
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'borrower_type') then
    create type borrower_type as enum (
      'primary_borrower',
      'co_borrower',
      'guarantor',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'borrower_relationship') then
    create type borrower_relationship as enum (
      'spouse',
      'parent',
      'sibling',
      'child',
      'friend',
      'business_partner',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'borrower_income_type') then
    create type borrower_income_type as enum (
      'salary',
      'hourly_wage',
      'commission',
      'bonus',
      'self_employment',
      'rental_income',
      'investment_income',
      'retirement_income',
      'other'
    );
  end if;
end $$;

--- current address and mailing address
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  street1 text,
  street2 text,
  city text,
  state text,
  postal_code text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists borrowers (
    
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,

  --- 1003 URLA | Loan Application fields
  type borrower_type not null,
  first_name text,
  last_name text,
  ssn_last4 char(4),
  ssn_encrypted bytea,
  dob date,
  phone text,
  email text,
  current_address_id uuid references addresses(id) on delete set null,
  mailing_address_id uuid references addresses(id) on delete set null,
  relationship borrower_relationship,
  income_type borrower_income_type,
  income_amount numeric,

  --- Demographic info
    ethnicity text,
    race text,
    gender text,
    marital_status text,
    dependents integer,
    employment_status text,
    employer_name text,
    job_title text,
    years_on_job integer,
    years_in_profession integer,
    work_phone text,
    work_email text,

    --- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
