import type { UserRole } from "@/types/auth";

// Central registry for the loan workspace rail.
// Keep labels and IDs here so routing, validation, and navigation rendering
// share one source of truth as the workspace grows past horizontal-tab scale.
export const WORKSPACE_NAV_GROUPS = [
  {
    id: "workflow",
    label: "Workflow",
    sections: [
      { id: "status",       label: "Status",       shortLabel: "St" },
      { id: "tasks",        label: "Tasks",        shortLabel: "Tk" },
      { id: "processing",   label: "Processing",   shortLabel: "Pr" },
      { id: "underwriting", label: "Underwriting", shortLabel: "UW" },
      { id: "conditions",   label: "Conditions",   shortLabel: "Co" },
      { id: "exceptions",   label: "Exceptions",   shortLabel: "Ex" },
      { id: "disclosures",  label: "Disclosures",  shortLabel: "Di" },
    ],
  },
  {
    id: "loan-file",
    label: "Loan File",
    sections: [
      { id: "home",             label: "Home",             shortLabel: "Ho" },
      { id: "borrower-urla",    label: "Borrower URLA",    shortLabel: "BU" },
      { id: "income",           label: "Financial Analysis", shortLabel: "FA" },
      { id: "subject-property", label: "Subject Property", shortLabel: "SP" },
      { id: "appraisal",        label: "Appraisal",        shortLabel: "Ap" },
      { id: "credit",           label: "Credit",           shortLabel: "Cr" },
      { id: "hmda",             label: "HMDA",             shortLabel: "HM" },
      { id: "documents",        label: "Documents",        shortLabel: "Do" },
      { id: "parties",          label: "Parties",          shortLabel: "Pa" },
      { id: "escrow",           label: "Escrow",           shortLabel: "Es" },
      { id: "title-legal",      label: "Title & Legal",    shortLabel: "TL" },
      { id: "loan-estimate",    label: "Loan Estimate",    shortLabel: "LE" },
      { id: "funding",          label: "Funding",          shortLabel: "Fu" },
      { id: "closing",          label: "Closing",          shortLabel: "Cl" },
    ],
  },
  {
    id: "team",
    label: "Team",
    sections: [
      { id: "conversation", label: "Conversation", shortLabel: "Cv" },
    ],
  },
  {
    id: "system",
    label: "System",
    sections: [
      { id: "audit-log", label: "Audit Log", shortLabel: "AL" },
    ],
  },
] as const;

export type WorkspaceSectionDef =
  (typeof WORKSPACE_NAV_GROUPS)[number]["sections"][number];

export type WorkspaceSection = WorkspaceSectionDef["id"];

export const ALL_SECTIONS: WorkspaceSectionDef[] = WORKSPACE_NAV_GROUPS.flatMap(
  (group) => [...group.sections],
);

export const ALL_SECTION_IDS = new Set<string>(ALL_SECTIONS.map((s) => s.id));

const SECTION_ALIASES: Record<string, WorkspaceSection> = {
  notes: "conversation",
  overview: "home",
  property: "subject-property",
  title: "title-legal",
};

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return ALL_SECTION_IDS.has(value);
}

export function resolveWorkspaceSection(value: string): WorkspaceSection {
  if (isWorkspaceSection(value)) return value;
  return SECTION_ALIASES[value] ?? "home";
}

// Per-role primary sections — UX Principles §Workspace Architecture.
// Roles not listed here (admin, account_executive) receive the full grouped rail.
export const ROLE_PRIMARY_SECTIONS: Partial<Record<UserRole, WorkspaceSection[]>> = {
  broker: ["home", "conditions", "documents", "conversation", "status"],
  processor: ["home", "tasks", "documents", "conditions", "processing", "title-legal", "conversation"],
  underwriter: ["home", "income", "credit", "borrower-urla", "exceptions", "conditions", "underwriting", "conversation"],
  funder: ["home", "funding", "conditions", "closing", "audit-log"],
  manager: ["home", "exceptions", "tasks", "status", "audit-log", "conversation"],
};

export function getPrimaryForRole(role?: UserRole | null): WorkspaceSectionDef[] | null {
  if (!role) return null;
  const ids = ROLE_PRIMARY_SECTIONS[role];
  if (!ids) return null;
  return ids
    .map((id) => ALL_SECTIONS.find((s) => s.id === id))
    .filter((s): s is WorkspaceSectionDef => s !== undefined);
}

export function getSecondaryForRole(role?: UserRole | null): WorkspaceSectionDef[] {
  const primary = getPrimaryForRole(role);
  if (!primary) return [];
  const primaryIds = new Set(primary.map((s) => s.id));
  return ALL_SECTIONS.filter((s) => !primaryIds.has(s.id));
}
