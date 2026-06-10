// Backend response shapes — mirrors src/backend/app/schemas/
// Keep in sync with the FastAPI Pydantic schemas.

// ── Auth ─────────────────────────────────────────────────────────────────────
export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type UserOut = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
};

// ── Loans ─────────────────────────────────────────────────────────────────────
export type LoanOut = {
  id: string;
  tenant_id: string;
  loan_number: string | null;
  status: string;
  assigned_to: string | null;
  purpose: string;
  loan_program: string | null;
  loan_product: string | null;
  occupancy_type: string | null;
  application_date: string | null;
  submitted_at: string | null;
  closing_date: string | null;
  funding_date: string | null;
  product_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  financials: LoanFinancialsOut | null;
  terms: LoanTermsOut | null;
};

export type LoanFinancialsOut = {
  loan_id: string;
  loan_amount: number | null;
  purchase_price: number | null;
  appraised_value: number | null;
  down_payment: number | null;
  ltv: number | null;
  cltv: number | null;
  fico_score: number | null;
  debt_to_income: number | null;
  dscr: number | null;
  cash_reserves: number | null;
  monthly_rent: number | null;
  monthly_income: number | null;
  updated_at: string;
};

export type LoanTermsOut = {
  loan_id: string;
  interest_rate: number | null;
  initial_rate: number | null;
  term_months: number | null;
  amortization_type: string | null;
  rate_type: string | null;
  payment_type: string | null;
  interest_rate_locked: boolean;
  rate_lock_date: string | null;
  rate_lock_days: number | null;
  lock_expiration_date: string | null;
  updated_at: string;
};

// ── Borrowers ─────────────────────────────────────────────────────────────────
export type BorrowerOut = {
  id: string;
  loan_id: string;
  type: "primary_borrower" | "co_borrower" | "guarantor" | "other";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  dob: string | null;
  relationship: string | null;
  income_type: string | null;
  income_amount: number | null;
  employment_status: string | null;
  employer_name: string | null;
  job_title: string | null;
  years_on_job: number | null;
  years_in_profession: number | null;
  work_phone: string | null;
  marital_status: string | null;
  dependents: number | null;
  ethnicity: string | null;
  race: string | null;
  gender: string | null;
  created_at: string;
  updated_at: string;
};

// ── Conditions ────────────────────────────────────────────────────────────────
export type ConditionStage = "prior_to_docs" | "prior_to_approval" | "prior_to_funding";
export type ConditionStatus = "open" | "submitted" | "cleared" | "waived" | "rejected";

export type ConditionOut = {
  id: string;
  loan_id: string;
  name: string;
  description: string | null;
  condition_number: number;
  status: ConditionStatus;
  stage: ConditionStage;
  cleared_by: string | null;
  cleared_at: string | null;
  waived_by: string | null;
  waived_at: string | null;
  waive_reason: string | null;
  created_at: string;
  updated_at: string;
};

// ── Properties ────────────────────────────────────────────────────────────────
export type PropertyOut = {
  id: string;
  loan_id: string;
  is_subject: boolean;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  property_type: string | null;
  occupancy: string | null;
  created_at: string;
  updated_at: string;
};

// ── Pipeline summary (GET /loans/pipeline) ────────────────────────────────────
export type LoanPipelineSummaryOut = {
  id: string;
  loan_number: string | null;
  status: string;
  loan_program: string | null;
  submitted_at: string | null;
  updated_at: string;
  loan_amount: number | null;
  borrower_name: string;
  property_state: string | null;
  conditions_open: number;
  conditions_submitted: number;
  actions_needed: number;
};

// ── Paginated list wrapper ────────────────────────────────────────────────────
export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

// ── API error ─────────────────────────────────────────────────────────────────
export type ApiError = {
  detail: string;
};
