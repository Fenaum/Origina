// Backend response shapes — mirrors src/backend/app/schemas/
// Keep in sync with the FastAPI Pydantic schemas.

// ── Documents ─────────────────────────────────────────────────────────────────
export type DocumentOut = {
  id: string;
  tenant_id: string;
  loan_id: string;
  doc_type: string | null;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_key: string;
  sha256: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  tags: Record<string, unknown>;
  condition_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
};

// ── Loan submission ───────────────────────────────────────────────────────────
export type LoanSubmitOut = {
  id: string;
  loan_number: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  borrower_name: string | null;
  loan_amount: number | null;
  loan_program: string | null;
};

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
  borrower_relationship: string | null;
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

// ── Context menu / Quick Actions ─────────────────────────────────────────────
export type LoanQuickInfoOut = {
  id: string;
  loan_number: string | null;
  status: string;
  loan_program: string | null;
  purpose: string | null;
  loan_amount: number | null;
  borrower_name: string;
  property_state: string | null;
  submitted_at: string | null;
  updated_at: string;
  ltv: number | null;
  cltv: number | null;
  fico_score: number | null;
  debt_to_income: number | null;
  dscr: number | null;
};

export type SandboxOut = {
  sandbox_id: string;
  url: string;
  message: string;
};

// ── Property (extended) ───────────────────────────────────────────────────────
export type PropertyDetailOut = PropertyOut & {
  county: string | null;
  census_tract: string | null;
  msa: string | null;
  apn: string | null;
  year_built: number | null;
  square_footage: number | null;
  lot_size_sqft: number | null;
  units: number | null;
  is_mixed_use: boolean | null;
  is_rural: boolean | null;
  is_condo_pud: boolean | null;
  flood_zone: string | null;
  flood_insurance_required: boolean | null;
  annual_taxes: number | null;
  hazard_insurance: number | null;
  hoa_dues: number | null;
  value_source: string | null;
  estimated_value: number | null;
};

// ── Loan Status ───────────────────────────────────────────────────────────────
export type StatusTransitionOption = { status: string; label: string };
export type LoanStatusOut = {
  loan_id: string;
  current_status: string;
  current_status_label: string;
  is_terminal: boolean;
  available_transitions: StatusTransitionOption[];
};

export type StatusEventOut = {
  id: string;
  loan_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_user_id: string | null;
  occurred_at: string;
};

// ── Appraisal ─────────────────────────────────────────────────────────────────
export type AppraisalOrderOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  ordered_date: string | null;
  ordered_by: string | null;
  vendor_name: string | null;
  appraiser_name: string | null;
  external_ref: string | null;
  due_date: string | null;
  inspection_date: string | null;
  received_date: string | null;
  appraised_value: number | null;
  purchase_price: number | null;
  appraisal_type: string | null;
  property_condition: string | null;
  review_status: string | null;
  reviewed_by: string | null;
  review_date: string | null;
  has_rov: boolean | null;
  second_appraisal: boolean | null;
  review_notes: string | null;
  is_primary: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Credit ────────────────────────────────────────────────────────────────────
export type CreditReportOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  report_date: string | null;
  vendor: string | null;
  reference_number: string | null;
  equifax_score: number | null;
  experian_score: number | null;
  transunion_score: number | null;
  middle_score: number | null;
  rep_score: number | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditLiabilityOut = {
  id: string;
  loan_id: string;
  credit_report_id: string | null;
  tradeline_type: string | null;
  creditor_name: string | null;
  account_number_last4: string | null;
  balance: number | null;
  monthly_payment: number | null;
  credit_limit: number | null;
  is_excluded: boolean;
  paid_at_closing: boolean;
  omit_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditEventOut = {
  id: string;
  loan_id: string;
  event_type: string;
  event_date: string | null;
  discharged_date: string | null;
  months_since: number | null;
  explanation: string | null;
  created_at: string;
  updated_at: string;
};

// ── Escrow ────────────────────────────────────────────────────────────────────
export type EscrowDetailOut = {
  id: string;
  loan_id: string;
  company_name: string | null;
  officer_name: string | null;
  officer_email: string | null;
  officer_phone: string | null;
  company_address: string | null;
  escrow_number: string | null;
  contract_date: string | null;
  closing_date: string | null;
  settlement_agent: string | null;
  earnest_money_deposit: number | null;
  wire_instructions_status: string | null;
  estimated_cash_to_close: number | null;
  verified_cash_to_close: number | null;
  seller_credits: number | null;
  lender_credits: number | null;
  third_party_fees: number | null;
  escrow_balance: number | null;
  closing_protection_letter: boolean;
  settlement_stmt_reviewed: boolean;
  wire_verified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Title ─────────────────────────────────────────────────────────────────────
export type TitleExceptionOut = {
  id: string;
  loan_id: string;
  title_order_id: string | null;
  exception_type: string;
  description: string | null;
  holder_name: string | null;
  amount: number | null;
  exception_status: string;
  resolution: string | null;
  cleared_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TitleOrderOut = {
  id: string;
  loan_id: string;
  company_name: string | null;
  officer_name: string | null;
  officer_email: string | null;
  officer_phone: string | null;
  ordered_date: string | null;
  commitment_received_date: string | null;
  title_status: string;
  external_ref: string | null;
  borrower_vesting: string | null;
  ownership_type: string | null;
  entity_vesting: string | null;
  vesting_notes: string | null;
  cleared_date: string | null;
  cleared_by: string | null;
  funding_blocked: boolean;
  funding_block_reason: string | null;
  legal_review_required: boolean;
  legal_reviewer: string | null;
  legal_review_status: string | null;
  legal_review_notes: string | null;
  notes: string | null;
  exceptions: TitleExceptionOut[];
  created_at: string;
  updated_at: string;
};

// ── Field History ─────────────────────────────────────────────────────────────
export type FieldHistoryEntry = {
  audit_log_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_key: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_at: string;
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskOut = {
  id: string;
  tenant_id: string;
  loan_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  due_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ── Exceptions ────────────────────────────────────────────────────────────────
// Legacy values (open, closed) preserved for existing data.
// New workflow states added in migration 119_exceptions_stabilize.sql.
export type ExceptionStatus =
  | "open"                        // legacy
  | "draft"
  | "submitted"
  | "assigned"
  | "under_review"
  | "additional_info_requested"
  | "approved"
  | "approved_with_conditions"
  | "denied"
  | "withdrawn"
  | "closed";                     // legacy terminal

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";
export type ExceptionSource = "pre_file" | "loan_file";

// A single compensating or risk factor selection.
export type ExceptionFactor = {
  code: string;
  notes: string | null;
};

export type ExceptionOut = {
  id: string;
  tenant_id: string;
  loan_id: string | null;
  exception_type: string;
  title: string;
  description: string | null;
  status: ExceptionStatus;
  severity: ExceptionSeverity;

  // Classification (Phase 2)
  primary_category: string;
  reason_code: string;
  related_categories: string[];
  context_type: string;
  exception_source: ExceptionSource;

  // Workflow (Phase 2)
  assigned_to: string | null;
  submitted_at: string | null;

  // Display text fields (kept for rendering)
  guideline_value: string | null;
  actual_value: string | null;
  variance: string | null;
  justification: string | null;

  // Structured numeric metrics (Phase 2)
  metric_type: string | null;
  guideline_operator: string | null;
  metric_guideline: number | null;
  metric_actual: number | null;
  metric_variance: number | null;
  metric_variance_unit: string | null;

  // Structured factor arrays (Phase 2)
  compensating_factors: ExceptionFactor[];
  risk_factors: ExceptionFactor[];

  loan_snapshot: Record<string, unknown>;
  loan_snapshot_hash: string | null;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExceptionEventOut = {
  id: string;
  tenant_id: string;
  exception_id: string;
  event_type: string;
  actor_user_id: string | null;
  event_data: Record<string, unknown>;
  occurred_at: string;
};

export type ExceptionCommentOut = {
  id: string;
  tenant_id: string;
  exception_id: string;
  body: string;
  created_by: string | null;
  is_internal: boolean;
  created_at: string;
};

export type ExceptionDocumentOut = {
  id: string;
  tenant_id: string;
  exception_id: string;
  document_id: string;
  attached_by: string | null;
  attached_at: string;
};

// ── API error ─────────────────────────────────────────────────────────────────
export type ApiError = {
  detail: string;
};
