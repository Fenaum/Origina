"use client";
// Top-level controller for the loan workspace experience.
// It owns tab selection via the URL query string and delegates each section to
// its dedicated workspace module.
import Link from "next/link";
import { useRouter } from "next/router";
import { NotificationBell } from "@/components/app/NotificationBell";
import { LoanWorkspaceRail } from "@/components/loans/LoanWorkspaceRail";
import { WorkspaceAuditLog } from "@/components/loans/workspace/WorkspaceAuditLog";
import { WorkspaceBorrowerURLA } from "@/components/loans/workspace/WorkspaceBorrowerURLA";
import { WorkspaceClosing } from "@/components/loans/workspace/WorkspaceClosing";
import { WorkspaceConditions } from "@/components/loans/workspace/WorkspaceConditions";
import { WorkspaceConversation } from "@/components/loans/workspace/WorkspaceConversation";
import { WorkspaceDisclosures } from "@/components/loans/workspace/WorkspaceDisclosures";
import { WorkspaceDocuments } from "@/components/loans/workspace/WorkspaceDocuments";
import { WorkspaceFunding } from "@/components/loans/workspace/WorkspaceFunding";
import { WorkspaceHMDA } from "@/components/loans/workspace/WorkspaceHMDA";
import { WorkspaceHome } from "@/components/loans/workspace/WorkspaceHome";
import { WorkspaceIncome } from "@/components/loans/workspace/WorkspaceIncome";
import { WorkspaceLoanEstimate } from "@/components/loans/workspace/WorkspaceLoanEstimate";
import { WorkspaceParties } from "@/components/loans/workspace/WorkspaceParties";
import { WorkspaceProcessing } from "@/components/loans/workspace/WorkspaceProcessing";
import { WorkspaceUnderwriting } from "@/components/loans/workspace/WorkspaceUnderwriting";
import {
  resolveWorkspaceSection,
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
  const section = resolveWorkspaceSection(rawSection);

  function goTo(next: WorkspaceSection) {
    // Use shallow routing so tab changes do not remount the full page shell.
    void router.push(
      { query: { loanId: loan.id, section: next } },
      undefined,
      { shallow: true },
    );
  }

  const riskMetric = loan.loanProgram === "dscr" ? "DSCR pending" : "DTI pending";

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
            <span className="loan-file-sep" aria-hidden>·</span>
            <span className="loan-file-meta">Purpose pending</span>
            <span className="loan-file-sep" aria-hidden>·</span>
            <span className="loan-file-meta">{riskMetric}</span>
            <span className="loan-file-sep" aria-hidden>·</span>
            <span className="loan-file-meta">Owner: {loan.owner}</span>
          </div>

          <div className="loan-file-actions">
            <span className="loan-file-state">{loan.propertyState}</span>
            <button
              type="button"
              className="loan-file-primary-action"
              onClick={() => goTo("processing")}
            >
              Move File
            </button>
            <NotificationBell />
          </div>
        </div>

      </div>

      <div className="loan-workspace-body">
        <LoanWorkspaceRail
          activeSection={section}
          loan={loan}
          onSectionChange={goTo}
        />
        <div className="loan-workspace-content">
          <WorkspaceContent section={section} loan={loan} />
        </div>
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
  if (section === "hmda") return <WorkspaceHMDA loan={loan} />;
  if (section === "documents") return <WorkspaceDocuments loan={loan} />;
  if (section === "disclosures") return <WorkspaceDisclosures loan={loan} />;
  if (section === "funding") return <WorkspaceFunding loan={loan} />;
  if (section === "closing") return <WorkspaceClosing loan={loan} />;
  if (section === "conversation") return <WorkspaceConversation loan={loan} />;
  if (section === "audit-log") return <WorkspaceAuditLog loan={loan} />;
  return <WorkspaceHome loan={loan} />;
}
