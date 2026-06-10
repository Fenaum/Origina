// Central registry for the loan workspace tab bar.
// Keep labels and IDs here so routing, validation, and tab rendering share the
// same source of truth.
export const ALL_SECTIONS = [
  { id: "home",           label: "Home" },
  { id: "processing",     label: "Processing" },
  { id: "underwriting",   label: "Underwriting" },
  { id: "conditions",     label: "Conditions" },
  { id: "documents",      label: "Documents" },
  { id: "parties",        label: "Parties" },
  { id: "notes",          label: "Notes" },
  { id: "borrower-urla",  label: "Borrower URLA" },
  { id: "income",         label: "Income" },
  { id: "hmda",           label: "HMDA" },
  { id: "loan-estimate",  label: "Loan Estimate" },
  { id: "audit-log",      label: "Audit Log" },
] as const;

export type WorkspaceSection = (typeof ALL_SECTIONS)[number]["id"];

export const ALL_SECTION_IDS = new Set<string>(ALL_SECTIONS.map((s) => s.id));

// Guards query-string values before they are used as typed workspace sections.
export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return ALL_SECTION_IDS.has(value);
}
