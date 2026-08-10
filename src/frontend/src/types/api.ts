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

// ── Activity feed ─────────────────────────────────────────────────────────────
export type ActivityEventType = "note" | "status_change" | "condition_change" | "document_upload";

export type ActivityEventOut = {
  id: string;
  event_type: ActivityEventType;
  occurred_at: string;
  actor_name: string | null;
  detail: string;
  body: string | null;
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
  roles: string[];
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

// ── Loan detail (Sprint 6 §6.2) ───────────────────────────────────────────────
// Single-fetch response for the workspace home panel. Replaces the
// multi-endpoint waterfall + the pipeline-with-limit=1000 hack that
// `getLoanById` used to do.
export type LoanDetailOut = LoanOut & {
  primary_borrower: BorrowerSummaryOut | null;
  co_borrowers: BorrowerSummaryOut[];
  subject_property: PropertySummaryOut | null;
  other_properties: PropertySummaryOut[];
};

export type BorrowerSummaryOut = {
  id: string;
  loan_id: string;
  type: "primary_borrower" | "co_borrower" | "guarantor" | "other";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  dob: string | null;
  income_type: string | null;
  income_amount: number | null;
  employer_name: string | null;
};

export type PropertySummaryOut = {
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
  // Sprint 4 §4.1 — pipeline owner column
  assigned_to: string | null;
  assigned_to_name: string | null;
};

// ── Paginated list wrapper ────────────────────────────────────────────────────
export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

// ── Pagination envelope (Sprint 1) ─────────────────────────────────────────────
// Standard envelope returned by all paginated list endpoints (matches the
// backend Pydantic PaginatedResponse[T] schema).
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
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

// ── Notes (Sprint 3 §3.1) ─────────────────────────────────────────────────────
export type NoteOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

// ── Decisioning runs (Sprint 3 §3.3) ──────────────────────────────────────────
export type PricingRunOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  run_at: string;
  run_by: string | null;
  input_hash: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
};

export type EligibilityRunOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  run_at: string;
  run_by: string | null;
  input_hash: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
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

// ── Exception decisions (Phase 3) ────────────────────────────────────────────
export type ExceptionDecisionConditionOut = {
  id: string;
  tenant_id: string;
  exception_id: string;
  decision_id: string;
  condition_category: string;
  action: string;
  target: string | null;
  imposed_value: string | null;
  imposed_value_numeric: number | null;
  is_required: boolean;
  status: string;
  satisfaction_date: string | null;
  satisfaction_user_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExceptionDecisionOut = {
  id: string;
  tenant_id: string;
  exception_id: string;
  decision_type: string;
  decided_by: string | null;
  decided_at: string;
  rationale: string | null;
  created_at: string;
  conditions: ExceptionDecisionConditionOut[];
};

// ── Exception summary (Phase 4) ───────────────────────────────────────────────
export type ExceptionSummaryOut = {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
};

// ── User / current user settings ────────────────────────────────────────────────
export type UserMeOut = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  title: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  bio: string | null;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

export type UserSessionOut = {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

// ── Tenant / organization settings ──────────────────────────────────────────────
export type TenantSettingsOut = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  support_email: string | null;
  business_hours: Record<string, string | null>;
  audit_retention_days: number;
  mfa_required: boolean;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  occurred_at: string;
  reason: string | null;
  diff: Record<string, unknown>;
};

export type AuditLogResponse = {
  items: AuditLogEntry[];
  total: number;
  skip: number;
  limit: number;
};

// ── API error ─────────────────────────────────────────────────────────────────
export type ApiError = {
  detail: string;
};

// ── Capital Markets (CM) — mirrors src/backend/app/services/cm/*_repo.py + 
//    src/backend/app/api/v1/cm.py out-shapes (migrations 135–141).
//    Per ADR 8 (Reproducibility as a CI-Enforced Invariant) every persisted
//    decision carries snapshot + version metadata so the frontend can render
//    "what was this priced against" hints. ──────────────────────────────────

// ── Pipeline / cockpit ────────────────────────────────────────────────────────
export type CMPipelineBalances = {
  locked: number;
  floating: number;
  expected_funded: number;
  total_under_lock: number;
};

export type CMPipelineSummary = {
  balances: CMPipelineBalances;
  lock_counts: Record<string, number>;
  open_alerts: number;
};

// ── Locks ─────────────────────────────────────────────────────────────────────
export type LockStatus =
  | "requested"
  | "confirmed"
  | "extended"
  | "reprice_required"
  | "expired"
  | "cancelled"
  | "funded_delivered";

export type CMLockOut = {
  id: string;
  loan_id: string;
  rate_sheet_id: string;
  snapshot_hash: string;
  snapshot_versions: Record<string, string>;
  rate_bps: number;
  base_price: number;
  llpa_adjustments: Record<string, unknown>;
  srp_bps: number;
  delivery_fee: number;
  adjusted_price: number;
  net_price: number;
  calc_version: string;
  lock_period_days: number;
  requested_at: string | null;
  confirmed_at: string | null;
  expires_at: string | null;
  requested_by: string | null;
  confirmed_by: string | null;
  status: LockStatus;
  reprice_required_at: string | null;
  prior_lock_id: string | null;
};

export type CMLockRequestBody = {
  loan_id: string;
  investor_program_id: string;
  lock_period_days: number;
};

// ── Loan CM summary ──────────────────────────────────────────────────────────
export type CMEligibilityHit = {
  rule_code: string;
  op: string;
  expected: number;
  observed: number;
  severity: string;
  source: string;
  passed: boolean;
};

export type CMEligibilityResult = {
  investor_program_id: string;
  investor_name: string;
  program_name: string;
  passed: boolean;
  failing_rules: CMEligibilityHit[];
};

export type CMBestExRankedRow = {
  rank: number;
  investor_program_id: string;
  investor_name: string;
  program_name: string;
  eligibility_passed: boolean;
  failing_rules: CMEligibilityHit[];
  base_price: number;
  llpa_adjustments: Record<string, unknown>;
  srp_bps: number;
  delivery_fee: number;
  net_proceeds: number;
  net_price: number;
  rate_bps: number;
  margin_bps: number;
};

export type CMBestExRunOut = {
  run_id: string;
  loan_id: string;
  chosen: CMBestExRankedRow | null;
  ranked: CMBestExRankedRow[];
  rationale: string;
  snapshot_hash: string;
  variance_to_second: number | null;
  calc_version: string;
  evaluated_at: string;
};

export type CMAlertOut = {
  id: string;
  alert_type: string;
  severity: string;
  status: "open" | "ack" | "resolved";
  loan_id: string | null;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  raised_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type CMLoanCMSummary = {
  loan_id: string;
  loan_number: string | null;
  current_lock: CMLockOut | null;
  lock_history: CMLockOut[];
  latest_best_ex: CMBestExRunOut | null;
  best_ex_history: CMBestExRunOut[];
  open_alerts: CMAlertOut[];
  pool_membership: { pool_id: string; pool_name: string }[];
};

// ── Pools ─────────────────────────────────────────────────────────────────────
export type CMPoolWaStats = {
  loan_count: number;
  total_balance: number;
  avg_fico: number | null;
  avg_ltv: number | null;
  avg_dscr: number | null;
  avg_rate_bps: number | null;
  weighted_rate_bps: number | null;
};

export type CMPoolOut = {
  id: string;
  name: string;
  status: string;
  pool_type: string;
  target_investor_program_id: string | null;
  wa_stats: CMPoolWaStats;
  loan_count: number;
  created_at: string;
};

// ── Allocation ────────────────────────────────────────────────────────────────
export type CMAllocationOut = {
  id: string;
  loan_id: string;
  pool_id: string | null;
  best_execution_run_id: string;
  investor_program_id: string;
  status: "active" | "superseded" | "cancelled";
  prior_allocation_id: string | null;
  override_reason: string | null;
  override_actor_user_id: string | null;
  notes: string | null;
  allocated_by: string;
  allocated_at: string;
};

export type CMAllocationRequestBody = {
  loan_id: string;
  best_execution_run_id: string;
  investor_program_id: string;
  pool_id?: string | null;
  override_reason?: string | null;
  override_actor_user_id?: string | null;
  notes?: string | null;
};

// ── Material-change watcher (PoC demo control) ───────────────────────────────
export type CMMaterialChangeHit = {
  field: string;
  impact: string;
  severity: "warn" | "block";
  observed_value: unknown;
  snapshot_value: unknown;
  description: string;
};

export type CMMaterialChangeResult = {
  loan_id: string;
  prior_hash: string;
  current_hash: string;
  changed: boolean;
  hits: CMMaterialChangeHit[];
  flags_raised: number;
  alerts_raised: number;
};

// ── Audit chain ───────────────────────────────────────────────────────────────
export type CMAuditLockEvent = {
  kind: "lock_event";
  id: string;
  lock_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  occurred_at: string;
};

export type CMAuditEligibility = {
  kind: "eligibility";
  id: string;
  investor_program_id: string;
  passed: boolean;
  failing_rules: CMEligibilityHit[];
  evaluated_at: string;
};

export type CMAuditBestEx = {
  kind: "best_ex_run";
  id: string;
  chosen_investor_program_id: string | null;
  rationale: string;
  evaluated_at: string;
};

export type CMAuditAllocation = {
  kind: "allocation";
  id: string;
  investor_program_id: string;
  status: string;
  override_reason: string | null;
  allocated_by: string;
  allocated_at: string;
};

export type CMAuditLogRow = {
  kind: "audit_log";
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  occurred_at: string;
  diff: Record<string, unknown>;
};

export type CMAuditEntry =
  | CMAuditLockEvent
  | CMAuditEligibility
  | CMAuditBestEx
  | CMAuditAllocation
  | CMAuditLogRow;

export type CMAuditChain = CMAuditEntry[];

// ── Demo control: shift market ±25bp (Sprint 7 §14.4 demo-only shortcut) ────
export type MarketShiftDelta = -25 | -10 | 0 | 10 | 25;

// ── /cm/loans list row (Pipeline + Lock queue modules) ──────────────────────
export type CMListLoanLock = {
  id: string;
  status: LockStatus;
  rate_bps: number | null;
  net_price: number | null;
  lock_period_days: number;
  snapshot_hash: string;
  expires_at: string | null;
  reprice_required_at: string | null;
  prior_lock_id: string | null;
};

export type CMListLoanRow = {
  loan_id: string;
  loan_number: string | null;
  loan_amount: number | null;
  loan_program: string | null;
  fico_score: number | null;
  ltv: number | null;
  property_state: string | null;
  lock: CMListLoanLock;
  open_alert_count: number;
};
