"use client";
// Top-level controller for the loan workspace experience.
// It owns tab selection via the URL query string and delegates each section to
// its dedicated workspace module.
import Link from "next/link";
import { useRouter } from "next/router";
import { NotificationBell } from "@/components/app/NotificationBell";
import { WorkspaceBorrowerURLA } from "@/components/loans/workspace/WorkspaceBorrowerURLA";
import { WorkspaceConditions } from "@/components/loans/workspace/WorkspaceConditions";
import { WorkspaceHome } from "@/components/loans/workspace/WorkspaceHome";
import { WorkspaceIncome } from "@/components/loans/workspace/WorkspaceIncome";
import { WorkspaceLoanEstimate } from "@/components/loans/workspace/WorkspaceLoanEstimate";
import { WorkspaceParties } from "@/components/loans/workspace/WorkspaceParties";
import { WorkspacePlaceholder } from "@/components/loans/workspace/WorkspacePlaceholder";
import { WorkspaceProcessing } from "@/components/loans/workspace/WorkspaceProcessing";
import { WorkspaceUnderwriting } from "@/components/loans/workspace/WorkspaceUnderwriting";
import {
  ALL_SECTIONS,
  isWorkspaceSection,
  type WorkspaceSection,
} from "@/components/loans/workspace/workspaceSections";
import { loanStatusLabels, type LoanSummary } from "@/types/loan";

const amountFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

type Props = {
  loan: LoanSummary;
};

export function LoanWorkspaceShell({ loan }: Props) {
  const router = useRouter();
  const rawSection = String(router.query.section ?? "");
  const section: WorkspaceSection =
    isWorkspaceSection(rawSection) ? rawSection : "home";

  function goTo(next: WorkspaceSection) {
    // Use shallow routing so tab changes do not remount the full page shell.
    void router.push(
      { query: { loanId: loan.id, section: next } },
      undefined,
      { shallow: true },
    );
  }

  return (
    <>
      <div className="loan-file-topbar">
        <div className="loan-file-header">
          <nav className="loan-file-breadcrumb" aria-label="File navigation">
            <Link href="/loans">Pipeline</Link>
            <span className="loan-file-sep" aria-hidden>›</span>
            <span>{loan.borrowerName}</span>
          </nav>

          <div className="loan-file-identity">
            <span className="loan-file-borrower">{loan.borrowerName}</span>
            <span className="loan-file-number">{loan.loanNumber}</span>
            <span className="status-pill">{loanStatusLabels[loan.status]}</span>
            <span className="loan-file-sep" aria-hidden>·</span>
            <span className="loan-file-meta">{amountFormatter.format(loan.loanAmount)}</span>
            {loan.loanProgram ? (
              <>
                <span className="loan-file-sep" aria-hidden>·</span>
                <span className="loan-file-meta loan-file-program">{loan.loanProgram}</span>
              </>
            ) : null}
          </div>

          <div className="loan-file-actions">
            <span className="loan-file-state">{loan.propertyState}</span>
            <NotificationBell />
          </div>
        </div>

        <nav className="loan-workspace-nav" aria-label="Loan file sections">
          {ALL_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`workspace-tab${section === s.id ? " active" : ""}`}
              onClick={() => goTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="loan-workspace-content">
        <WorkspaceContent section={section} loan={loan} />
      </div>
    </>
  );
}

function WorkspaceContent({ section, loan }: { section: WorkspaceSection; loan: LoanSummary }) {
  if (section === "home") return <WorkspaceHome loan={loan} />;
  if (section === "borrower-urla") return <WorkspaceBorrowerURLA loan={loan} />;
  if (section === "loan-estimate") return <WorkspaceLoanEstimate loan={loan} />;
  if (section === "conditions") return <WorkspaceConditions loan={loan} />;
  if (section === "underwriting") return <WorkspaceUnderwriting loan={loan} />;
  if (section === "processing") return <WorkspaceProcessing loan={loan} />;
  if (section === "parties") return <WorkspaceParties loan={loan} />;
  if (section === "income") return <WorkspaceIncome loan={loan} />;
  const labels: Partial<Record<WorkspaceSection, string>> = {
    processing:   "Processing",
    underwriting: "Underwriting",
    documents:    "Documents",
    notes:        "Notes / Internal Conversation",
    hmda:         "HMDA — Government Monitoring",
    "audit-log":  "Audit Log",
  };
  return (
    <WorkspacePlaceholder
      title={labels[section] ?? section}
      description="This section is reserved and will be built out in a future milestone."
    />
  );
}
