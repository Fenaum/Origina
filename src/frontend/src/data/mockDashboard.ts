import type { DashboardMetric, StatusItem } from "@/types/dashboard";
import type { UserRole } from "@/types/auth";

export const dashboardMetrics: Record<UserRole, DashboardMetric[]> = {
  account_executive: [
    { label: "Pipeline Volume", value: "$18.4M", detail: "42 active loans" },
    { label: "Recent Submissions", value: "11", detail: "Last 7 days", tone: "success" },
    { label: "Broker Follow-ups", value: "8", detail: "Due this week", tone: "warning" },
    { label: "Conditions Needing Action", value: "17", detail: "Across assigned pipeline" },
  ],
  broker: [
    { label: "Active Loans", value: "24", detail: "6 in conditions review" },
    { label: "Borrower Tasks", value: "9", detail: "Documents or signatures needed", tone: "warning" },
    { label: "Recent Submissions", value: "5", detail: "Last 7 days", tone: "success" },
    { label: "Approved Loans", value: "$3.2M", detail: "Ready for closing" },
  ],
  underwriter: [
    { label: "Underwriting Queue", value: "31", detail: "Oldest file: 2 business days", tone: "warning" },
    { label: "Conditions Submitted", value: "14", detail: "Ready for review" },
    { label: "Approvals This Week", value: "7", detail: "Across Non-QM programs", tone: "success" },
    { label: "Exceptions", value: "4", detail: "Pending decision" },
  ],
  borrower: [
    { label: "Application Progress", value: "62%", detail: "Income and assets next" },
    { label: "Documents Uploaded", value: "8", detail: "2 requested documents open" },
    { label: "Conditions Needing Action", value: "3", detail: "Awaiting borrower response", tone: "warning" },
    { label: "Loan Status", value: "Submitted", detail: "Team review in progress" },
  ],
};

export const dashboardStatusItems: Record<UserRole, StatusItem[]> = {
  account_executive: [
    { label: "Northline Lending", value: "3 new submissions", meta: "Broker partner" },
    { label: "Martinez refinance", value: "Conditions pending", meta: "Updated today" },
    { label: "Park purchase", value: "Ready for UW", meta: "Loan #OR-1028" },
  ],
  broker: [
    { label: "Application intake", value: "2 drafts need borrower data", meta: "Borrower portal" },
    { label: "Conditions", value: "5 open across pipeline", meta: "Action needed" },
    { label: "Submissions", value: "3 files accepted", meta: "This week" },
  ],
  underwriter: [
    { label: "Queue priority", value: "6 purchase files", meta: "SLA focus" },
    { label: "Submitted conditions", value: "14 ready to clear", meta: "Review queue" },
    { label: "Exception requests", value: "4 pending", meta: "Decisioning" },
  ],
  borrower: [
    { label: "Identity", value: "Complete", meta: "Application step" },
    { label: "Income", value: "In progress", meta: "Application step" },
    { label: "Assets", value: "Not started", meta: "Application step" },
  ],
};
