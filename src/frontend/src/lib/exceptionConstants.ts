import type { ExceptionSeverity, ExceptionStatus } from "@/types/api";

// ── Controlled value definitions ──────────────────────────────────────────────
// Mirror exception_schema.py constants. Keep in sync with backend.

export const PRIMARY_CATEGORIES: { value: string; label: string }[] = [
  { value: "credit",            label: "Credit" },
  { value: "collateral",        label: "Collateral" },
  { value: "income",            label: "Income" },
  { value: "assets_reserves",   label: "Assets / Reserves" },
  { value: "pricing",           label: "Pricing" },
  { value: "product_guideline", label: "Product / Guideline" },
  { value: "broker_account",    label: "Broker / Account" },
  { value: "documentation",     label: "Documentation" },
  { value: "compliance",        label: "Compliance" },
  { value: "other",             label: "Other" },
];

export const EXCEPTION_TYPES: { value: string; label: string }[] = [
  { value: "ltv",             label: "LTV Exception" },
  { value: "cltv",            label: "CLTV Exception" },
  { value: "credit_score",    label: "Credit Score Exception" },
  { value: "dscr",            label: "DSCR Exception" },
  { value: "dti",             label: "DTI Exception" },
  { value: "reserves",        label: "Reserve Exception" },
  { value: "price_match",     label: "Price Match Exception" },
  { value: "rate",            label: "Rate Exception" },
  { value: "fee",             label: "Fee Exception" },
  { value: "loan_amount",     label: "Loan Amount Exception" },
  { value: "occupancy",       label: "Occupancy Exception" },
  { value: "property_type",   label: "Property Type Exception" },
  { value: "seasoning",       label: "Seasoning Exception" },
  { value: "documentation",   label: "Documentation Exception" },
  { value: "broker_approval", label: "Broker Approval Exception" },
  { value: "income_type",     label: "Income Type Exception" },
  { value: "employment",      label: "Employment Exception" },
  { value: "other",           label: "Other" },
];

export const REASON_CODES: { value: string; label: string }[] = [
  { value: "strong_borrower_profile",       label: "Strong Borrower Profile" },
  { value: "minor_guideline_variance",      label: "Minor Guideline Variance" },
  { value: "competitive_price_match",       label: "Competitive Price Match" },
  { value: "investor_relationship",         label: "Investor Relationship" },
  { value: "strategic_broker_relationship", label: "Strategic Broker Relationship" },
  { value: "operational_exception",         label: "Operational Exception" },
  { value: "prior_approval_precedent",      label: "Prior Approval Precedent" },
  { value: "compensating_risk_profile",     label: "Compensating Risk Profile" },
  { value: "other",                         label: "Other" },
];

export const METRIC_TYPES: { value: string; label: string }[] = [
  { value: "ltv",         label: "LTV (%)" },
  { value: "cltv",        label: "CLTV (%)" },
  { value: "fico",        label: "FICO Score" },
  { value: "dti",         label: "DTI (%)" },
  { value: "dscr",        label: "DSCR" },
  { value: "rate",        label: "Rate (%)" },
  { value: "months",      label: "Months" },
  { value: "loan_amount", label: "Loan Amount ($)" },
  { value: "other",       label: "Other" },
];

export const VARIANCE_UNITS: { value: string; label: string }[] = [
  { value: "pct",     label: "%" },
  { value: "bps",     label: "bps" },
  { value: "months",  label: "months" },
  { value: "dollars", label: "$" },
  { value: "points",  label: "points" },
];

export const COMPENSATING_FACTORS: { code: string; label: string }[] = [
  { code: "high_fico",              label: "High FICO" },
  { code: "strong_reserves",        label: "Strong Reserves" },
  { code: "low_ltv",                label: "Low LTV" },
  { code: "low_dti",                label: "Low DTI" },
  { code: "strong_dscr",            label: "Strong DSCR" },
  { code: "stable_employment",      label: "Stable Employment" },
  { code: "strong_payment_history", label: "Strong Payment History" },
  { code: "significant_liquidity",  label: "Significant Liquidity" },
  { code: "strong_property_value",  label: "Strong Property Value" },
  { code: "borrower_experience",    label: "Borrower Experience" },
  { code: "low_layered_risk",       label: "Low Layered Risk" },
  { code: "other",                  label: "Other" },
];

export const RISK_FACTORS: { code: string; label: string }[] = [
  { code: "high_ltv",                 label: "High LTV" },
  { code: "low_fico",                 label: "Low FICO" },
  { code: "high_dti",                 label: "High DTI" },
  { code: "low_dscr",                 label: "Low DSCR" },
  { code: "cash_out",                 label: "Cash-Out" },
  { code: "investment_property",      label: "Investment Property" },
  { code: "limited_reserves",         label: "Limited Reserves" },
  { code: "recent_credit_event",      label: "Recent Credit Event" },
  { code: "thin_credit_profile",      label: "Thin Credit Profile" },
  { code: "concentration_risk",       label: "Concentration Risk" },
  { code: "incomplete_documentation", label: "Incomplete Documentation" },
  { code: "pricing_concession",       label: "Pricing Concession" },
  { code: "other",                    label: "Other" },
];

export const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open:                      "Open",
  draft:                     "Draft",
  submitted:                 "Submitted",
  assigned:                  "Assigned",
  under_review:              "Under Review",
  additional_info_requested: "Info Requested",
  approved:                  "Approved",
  approved_with_conditions:  "Approved w/ Conditions",
  denied:                    "Denied",
  withdrawn:                 "Withdrawn",
  closed:                    "Closed",
};

export const STATUS_CLASS: Record<ExceptionStatus, string> = {
  open:                      "exc-badge--open",
  draft:                     "exc-badge--draft",
  submitted:                 "exc-badge--submitted",
  assigned:                  "exc-badge--submitted",
  under_review:              "exc-badge--submitted",
  additional_info_requested: "exc-badge--open",
  approved:                  "exc-badge--approved",
  approved_with_conditions:  "exc-badge--approved",
  denied:                    "exc-badge--denied",
  withdrawn:                 "exc-badge--withdrawn",
  closed:                    "exc-badge--closed",
};

export const SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

export const SEVERITY_CLASS: Record<ExceptionSeverity, string> = {
  low:      "exc-sev--low",
  medium:   "exc-sev--medium",
  high:     "exc-sev--high",
  critical: "exc-sev--critical",
};

export function formatExcDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function labelFor(list: { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}
