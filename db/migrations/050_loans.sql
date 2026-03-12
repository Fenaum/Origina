-- =========================================================
-- db/migrations/050_loans.sql
-- =========================================================
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete restrict,

  loan_number text, -- optional internal number

  status loan_status not null default 'new_draft', -- current state of the loan
  assigned_to uuid references users(id) on delete set null,

  -- core figures (keep truth here)
  loan_amount numeric(14,2),
  purchase_price numeric(14,2),
  appraised_value numeric(14,2),
  down_payment numeric(14,2),
  ltv numeric(5,2), -- loan-to-value percentage
  cltv numeric(5,2), -- combined loan-to-value percentage
  fico_score integer,
  debt_to_income numeric(5,2), -- percentage
  dscr numeric(5,2), -- debt service coverage ratio (for commercial loans)
  cash_reserves numeric(14,2),
  monthly_rent numeric(14,2),
  monthly_income numeric(14,2),
  monthly_debt numeric(14,2),
  other_income numeric(14,2),
  other_debt numeric(14,2),
  credit_score integer,
  principal_and_interest numeric(14,2),
  current_balance numeric(14,2),
  escrow_amount numeric(14,2),
  total_monthly_payment numeric(14,2),
  property_taxes numeric(14,2),
  homeowners_insurance numeric(14,2),
  hoa_fees numeric(14,2),
  other_expenses numeric(14,2),

  -- key dates
  submitted_at date,
  application_date date,
  closing_date date,
  funding_date date,
  disbursement_date date,
  initial_disclosure_date date,
  closing_disclosure_date date,
  closing_redisclosure_date date,
  rate_lock date,
  lock_expiration_date date,
  le_redisclosure_date date,

  -- Loan details
  interest_rate_locked boolean default false,
  rate_lock_date date,
  rate_lock_days integer,
  initial_rate numeric(5,3),
  interest_rate numeric(5,3),
  term_months integer,
  amortization_type text, -- 'interest_only','fixed','adjustable','balloon','other'
  prepayment_penalty boolean,
  occupancy_type text, -- 'owner_occupied','second_home','investment','other'
  loan_program text, -- e.g., 'conventional','fha','va','jumbo','dscr', 'bank_statement'
  loan_product text, -- e.g., '30yr_fixed','15yr_fixed','5/1_arm', etc.
  purpose_detail text, -- additional details on purpose
  rate_type text, -- 'fixed','adjustable','hybrid','other'
  payment_type text, -- 'principal_and_interest','interest_only','other'
  purpose loan_purpose not null default 'purchase', -- 'purchase','refinance','cash_out','other'
  cashout_type text, -- 'none','home_equity','debt_consolidation','other'
  property_use text, -- 'primary_residence','second_home','investment_property','other'
  construction_type text, -- 'existing','new_construction','renovation','other'

  -- flexible product fields (limited use)
  product_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loans_tenant_status on loans (tenant_id, status);
create index if not exists idx_loans_tenant_assigned on loans (tenant_id, assigned_to);
create index if not exists idx_loans_tenant_created on loans (tenant_id, created_at desc);

create table if not exists loan_parties (
  tenant_id uuid not null references tenants(id) on delete restrict,
  loan_id uuid not null references loans(id) on delete cascade,
  party_id uuid not null references parties(id) on delete restrict,
  role text not null check (role in ('borrower','co_borrower','broker','seller','realtor','loan_officer','processor','underwriter','other')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, loan_id, party_id, role)
);

create index if not exists idx_loan_parties_loan on loan_parties (tenant_id, loan_id);
