// Central registry for the loan workspace rail.
// Keep labels and IDs here so routing, validation, and navigation rendering
// share one source of truth as the workspace grows past horizontal-tab scale.
export const WORKSPACE_NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    sections: [
      { id: "home", label: "Home", shortLabel: "H" },
    ],
  },
  {
    id: "workflow",
    label: "Workflow",
    sections: [
      { id: "processing", label: "Processing", shortLabel: "Pr" },
      { id: "underwriting", label: "Underwriting", shortLabel: "UW" },
      { id: "conditions", label: "Conditions", shortLabel: "Co" },
      { id: "disclosures", label: "Disclosures", shortLabel: "Di" },
    ],
  },
  {
    id: "loan-file",
    label: "Loan File",
    sections: [
      { id: "borrower-urla", label: "Borrower URLA", shortLabel: "BU" },
      { id: "income", label: "Financial Analysis", shortLabel: "FA" },
      { id: "hmda", label: "HMDA", shortLabel: "HM" },
      { id: "documents", label: "Documents", shortLabel: "Do" },
      { id: "parties", label: "Parties", shortLabel: "Pa" },
      { id: "funding", label: "Funding", shortLabel: "Fu" },
      { id: "closing", label: "Closing", shortLabel: "Cl" },
      { id: "loan-estimate", label: "Loan Estimate", shortLabel: "LE" },
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
};

// Guards query-string values before they are used as typed workspace sections.
export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return ALL_SECTION_IDS.has(value);
}

export function resolveWorkspaceSection(value: string): WorkspaceSection {
  if (isWorkspaceSection(value)) return value;
  return SECTION_ALIASES[value] ?? "home";
}
