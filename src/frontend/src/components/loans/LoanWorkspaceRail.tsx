import type { UserRole } from "@/types/auth";
import type { LoanSummary } from "@/types/loan";
import {
  WORKSPACE_NAV_GROUPS,
  getPrimaryForRole,
  getSecondaryForRole,
  type WorkspaceSection,
  type WorkspaceSectionDef,
} from "@/components/loans/workspace/workspaceSections";

type Props = {
  activeSection: WorkspaceSection;
  loan: LoanSummary;
  role?: UserRole | null;
  onSectionChange: (section: WorkspaceSection) => void;
};

export function LoanWorkspaceRail({ activeSection, loan, role, onSectionChange }: Props) {
  const primary = getPrimaryForRole(role);

  if (!primary) {
    // Admin / AE: full grouped rail
    return (
      <aside className="loan-workspace-rail" aria-label="Loan workspace navigation">
        {WORKSPACE_NAV_GROUPS.map((group) => (
          <div className="loan-rail-group" key={group.id}>
            <p className="loan-rail-group-label">{group.label}</p>
            <div className="loan-rail-group-items">
              {group.sections.map((section) => (
                <RailItem
                  key={section.id}
                  section={section}
                  active={activeSection === section.id}
                  badge={resolveBadge(section.id, loan)}
                  onClick={() => onSectionChange(section.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </aside>
    );
  }

  // Role-specific: primary sections first, rest behind "All Sections" disclosure
  const secondary = getSecondaryForRole(role);

  return (
    <aside className="loan-workspace-rail" aria-label="Loan workspace navigation">
      <div className="loan-rail-group">
        <div className="loan-rail-group-items">
          {primary.map((section) => (
            <RailItem
              key={section.id}
              section={section}
              active={activeSection === section.id}
              badge={resolveBadge(section.id, loan)}
              onClick={() => onSectionChange(section.id)}
            />
          ))}
        </div>
      </div>

      {secondary.length > 0 ? (
        <details className="loan-rail-more">
          <summary>All Sections</summary>
          <div className="loan-rail-group-items">
            {secondary.map((section) => (
              <RailItem
                key={section.id}
                section={section}
                active={activeSection === section.id}
                badge={resolveBadge(section.id, loan)}
                onClick={() => onSectionChange(section.id)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </aside>
  );
}

function RailItem({
  section,
  active,
  badge,
  onClick,
}: {
  section: WorkspaceSectionDef;
  active: boolean;
  badge: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`loan-rail-item${active ? " active" : ""}`}
      onClick={onClick}
      title={section.label}
      aria-current={active ? "page" : undefined}
    >
      <span className="loan-rail-mark" aria-hidden>
        {section.shortLabel}
      </span>
      <span className="loan-rail-label">{section.label}</span>
      {badge ? <span className="loan-rail-badge">{badge}</span> : null}
    </button>
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
