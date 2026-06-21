// Matches the loan_status enum in PostgreSQL (all values)
export type LoanStatus =
  | "new_draft"
  | "submitted"
  | "conditions_review"
  | "approved_pending"
  | "approved"
  | "denied"
  | "closed"
  | "funded"
  | "post_closing"
  | "archived"
  | "withdrawn"
  | "cancelled";

export type LoanPurpose = "purchase" | "refinance" | "cash_out" | "other";

export type LoanProgram =
  | "dscr"
  | "bank_statement"
  | "asset_depletion"
  | "interest_only"
  | "jumbo_non_qm"
  | "conventional"
  | "other";

// Active pipeline statuses (shown in the main pipeline view)
export const PIPELINE_STATUSES: LoanStatus[] = [
  "new_draft",
  "submitted",
  "conditions_review",
  "approved_pending",
  "approved",
];

export const loanProgramLabels: Record<LoanProgram, string> = {
  dscr:             "DSCR",
  bank_statement:   "Bank Statement",
  asset_depletion:  "Asset Depletion",
  interest_only:    "Interest Only",
  jumbo_non_qm:     "Jumbo Non-QM",
  conventional:     "Conventional",
  other:            "Other",
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  new_draft:         "New Draft",
  submitted:         "Submitted",
  conditions_review: "Conditions Review",
  approved_pending:  "Approved – Pending",
  approved:          "Approved",
  denied:            "Denied",
  closed:            "Closed",
  funded:            "Funded",
  post_closing:      "Post Closing",
  archived:          "Archived",
  withdrawn:         "Withdrawn",
  cancelled:         "Cancelled",
};

// Frontend view model — used by pipeline table and dashboard
export type LoanSummary = {
  id: string;
  borrowerName: string;
  loanNumber: string;
  channel: "Broker" | "Retail" | "Correspondent";
  status: LoanStatus;
  loanAmount: number;
  loanProgram: LoanProgram;
  propertyState: string;
  submittedAt: string | null;
  updatedAt: string;
  owner: string;
  conditionsOpen: number;
  conditionsSubmitted: number;
  actionsNeeded: number;
};

export type PipelineKpi = {
  label: string;
  value: string;
  detail: string;
};

export type ChartDatum = {
  name: string;
  value: number;
  amount?: number;
};

export type MonthlySubmissionDatum = {
  month: string;
  submissions: number;
};
