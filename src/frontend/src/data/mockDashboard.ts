import type { DashboardMetric, StatusItem } from "@/types/dashboard";
import type { UserRole } from "@/types/auth";

export const dashboardMetrics: Record<UserRole, DashboardMetric[]> = {
  admin: [
    { label: "Pipeline Volume", value: "$18.4M", detail: "42 active loans", href: "/loans" },
    { label: "Recent Submissions", value: "11", detail: "Last 7 days", tone: "success", href: "/loans?status=submitted" },
    { label: "Broker Follow-ups", value: "8", detail: "Due this week", tone: "warning", href: "/loans?actionNeeded=true" },
    { label: "Conditions Needing Action", value: "17", detail: "Across assigned pipeline", href: "/loans?conditionsOutstanding=true" },
  ],
  account_executive: [
    { label: "Pipeline Volume", value: "$18.4M", detail: "42 active loans", href: "/loans" },
    { label: "Recent Submissions", value: "11", detail: "Last 7 days", tone: "success", href: "/loans?status=submitted" },
    { label: "Broker Follow-ups", value: "8", detail: "Due this week", tone: "warning", href: "/loans?actionNeeded=true" },
    { label: "Conditions Needing Action", value: "17", detail: "Across assigned pipeline", href: "/loans?conditionsOutstanding=true" },
  ],
  broker: [
    { label: "Active Loans", value: "24", detail: "6 in conditions review", href: "/loans" },
    { label: "Borrower Tasks", value: "9", detail: "Documents or signatures needed", tone: "warning", href: "/loans?actionNeeded=true" },
    { label: "Recent Submissions", value: "5", detail: "Last 7 days", tone: "success", href: "/loans?status=submitted" },
    { label: "Approved Loans", value: "$3.2M", detail: "Ready for closing", href: "/loans?status=approved" },
  ],
  processor: [
    { label: "Active Files", value: "18", detail: "In processing", href: "/loans" },
    { label: "Conditions Pending", value: "11", detail: "Awaiting borrower response", tone: "warning", href: "/loans?conditionsOutstanding=true" },
    { label: "Cleared This Week", value: "6", detail: "Conditions resolved", tone: "success" },
    { label: "Ready for UW", value: "4", detail: "Files packaged", href: "/loans?status=conditions_review" },
  ],
  underwriter: [
    { label: "Underwriting Queue", value: "31", detail: "Oldest file: 2 business days", tone: "warning", href: "/loans?status=submitted" },
    { label: "Conditions Submitted", value: "14", detail: "Ready for review", href: "/loans?conditionsOutstanding=true" },
    { label: "Approvals This Week", value: "7", detail: "Across Non-QM programs", tone: "success" },
    { label: "Exceptions", value: "4", detail: "Pending decision", href: "/exceptions" },
  ],
  funder: [
    { label: "Approved Files", value: "9", detail: "Ready to fund", href: "/loans?status=approved" },
    { label: "Docs Outstanding", value: "3", detail: "Awaiting final docs", tone: "warning", href: "/loans?actionNeeded=true" },
    { label: "Funded This Week", value: "5", detail: "Total: $4.1M", tone: "success", href: "/loans?status=funded" },
    { label: "Wire Confirmations", value: "5", detail: "Confirmed" },
  ],
  manager: [
    { label: "Team Pipeline", value: "$22.7M", detail: "58 active loans", href: "/loans" },
    { label: "SLA At Risk", value: "4", detail: "Files past 48 hrs", tone: "warning", href: "/loans?actionNeeded=true" },
    { label: "Funded MTD", value: "$9.2M", detail: "Monthly target: $12M", tone: "success", href: "/loans?status=funded" },
    { label: "Open Exceptions", value: "6", detail: "Pending decisions", href: "/exceptions" },
  ],
  borrower: [
    { label: "Application Progress", value: "62%", detail: "Income and assets next" },
    { label: "Documents Uploaded", value: "8", detail: "2 requested documents open" },
    { label: "Conditions Needing Action", value: "3", detail: "Awaiting borrower response", tone: "warning" },
    { label: "Loan Status", value: "Submitted", detail: "Team review in progress" },
  ],
};

export const dashboardStatusItems: Record<UserRole, StatusItem[]> = {
  admin: [
    { label: "Northline Lending", value: "3 new submissions", meta: "Broker partner" },
    { label: "Martinez refinance", value: "Conditions pending", meta: "Updated today" },
    { label: "Park purchase", value: "Ready for UW", meta: "Loan #OR-1028" },
  ],
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
  processor: [
    { label: "Chen file", value: "Stips outstanding", meta: "Loan #OR-1031" },
    { label: "Patel refinance", value: "Packaged for UW", meta: "Loan #OR-1029" },
    { label: "Williams purchase", value: "Appraisal needed", meta: "Loan #OR-1033" },
  ],
  underwriter: [
    { label: "Queue priority", value: "6 purchase files", meta: "SLA focus" },
    { label: "Submitted conditions", value: "14 ready to clear", meta: "Review queue" },
    { label: "Exception requests", value: "4 pending", meta: "Decisioning" },
  ],
  funder: [
    { label: "Rodriguez closing", value: "Wire ready", meta: "Loan #OR-1024" },
    { label: "Park purchase", value: "Final docs pending", meta: "Loan #OR-1028" },
    { label: "Thompson refi", value: "Funded", meta: "Confirmed 2:14pm" },
  ],
  manager: [
    { label: "Team SLA", value: "4 files at risk", meta: "Escalate to UW" },
    { label: "Monthly target", value: "76% to goal", meta: "$9.2M of $12M" },
    { label: "Exception backlog", value: "6 pending", meta: "Avg age: 1.8 days" },
  ],
  borrower: [
    { label: "Identity", value: "Complete", meta: "Application step" },
    { label: "Income", value: "In progress", meta: "Application step" },
    { label: "Assets", value: "Not started", meta: "Application step" },
  ],
};
