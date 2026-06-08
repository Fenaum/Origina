export type LoanStatus =
  | "new_draft"
  | "submitted"
  | "conditions_review"
  | "approved"
  | "funded"
  | "closed";

export type LoanSummary = {
  id: string;
  borrowerName: string;
  loanNumber: string;
  channel: "Broker" | "Retail" | "Correspondent";
  status: LoanStatus;
  loanAmount: number;
  propertyState: string;
  submittedAt: string;
  updatedAt: string;
  owner: string;
  conditionsOpen: number;
  conditionsSubmitted: number;
  actionsNeeded: number;
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  new_draft: "New Draft",
  submitted: "Submitted",
  conditions_review: "Conditions Review",
  approved: "Approved",
  funded: "Funded",
  closed: "Closed",
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
