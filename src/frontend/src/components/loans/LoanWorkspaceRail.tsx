import {
  WORKSPACE_NAV_GROUPS,
  type WorkspaceSection,
} from "@/components/loans/workspace/workspaceSections";
import type { LoanSummary } from "@/types/loan";

type Props = {
  activeSection: WorkspaceSection;
  loan: LoanSummary;
  onSectionChange: (section: WorkspaceSection) => void;
};

export function LoanWorkspaceRail({ activeSection, loan, onSectionChange }: Props) {
  return (
    <aside className="loan-workspace-rail" aria-label="Loan workspace navigation">
      {WORKSPACE_NAV_GROUPS.map((group) => (
        <div className="loan-rail-group" key={group.id}>
          <p className="loan-rail-group-label">{group.label}</p>
          <div className="loan-rail-group-items">
            {group.sections.map((section) => {
              const badge = resolveBadge(section.id, loan);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`loan-rail-item${activeSection === section.id ? " active" : ""}`}
                  onClick={() => onSectionChange(section.id)}
                  title={section.label}
                  aria-current={activeSection === section.id ? "page" : undefined}
                >
                  <span className="loan-rail-mark" aria-hidden>
                    {section.shortLabel}
                  </span>
                  <span className="loan-rail-label">{section.label}</span>
                  {badge ? <span className="loan-rail-badge">{badge}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function resolveBadge(section: WorkspaceSection, loan: LoanSummary): string | null {
  if (section === "conditions" && loan.conditionsOpen > 0) {
    return String(loan.conditionsOpen);
  }
  if (section === "documents" && loan.actionsNeeded > 0) {
    return String(loan.actionsNeeded);
  }
  return null;
}
