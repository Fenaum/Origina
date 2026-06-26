"use client";
// Top-level controller for the loan workspace experience.
// It owns tab selection via the URL query string and delegates each section to
// its dedicated workspace module.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/state/auth";
import { WorkspaceActivityRail } from "@/components/loans/WorkspaceActivityRail";
import { NotificationBell } from "@/components/app/NotificationBell";
import { LoanWorkspaceRail } from "@/components/loans/LoanWorkspaceRail";
import { WorkspaceAppraisal } from "@/components/loans/workspace/WorkspaceAppraisal";
import { WorkspaceAuditLog } from "@/components/loans/workspace/WorkspaceAuditLog";
import { WorkspaceBorrowerURLA } from "@/components/loans/workspace/WorkspaceBorrowerURLA";
import { WorkspaceClosing } from "@/components/loans/workspace/WorkspaceClosing";
import { WorkspaceConditions } from "@/components/loans/workspace/WorkspaceConditions";
import { WorkspaceExceptions } from "@/components/loans/workspace/WorkspaceExceptions";
import { WorkspaceConversation } from "@/components/loans/workspace/WorkspaceConversation";
import { WorkspaceCredit } from "@/components/loans/workspace/WorkspaceCredit";
import { WorkspaceDisclosures } from "@/components/loans/workspace/WorkspaceDisclosures";
import { WorkspaceDocuments } from "@/components/loans/workspace/WorkspaceDocuments";
import { WorkspaceEscrow } from "@/components/loans/workspace/WorkspaceEscrow";
import { WorkspaceFunding } from "@/components/loans/workspace/WorkspaceFunding";
import { WorkspaceHMDA } from "@/components/loans/workspace/WorkspaceHMDA";
import { WorkspaceHome } from "@/components/loans/workspace/WorkspaceHome";
import { WorkspaceIncome } from "@/components/loans/workspace/WorkspaceIncome";
import { WorkspaceLoanEstimate } from "@/components/loans/workspace/WorkspaceLoanEstimate";
import { WorkspaceParties } from "@/components/loans/workspace/WorkspaceParties";
import { WorkspaceProcessing } from "@/components/loans/workspace/WorkspaceProcessing";
import { WorkspaceStatus } from "@/components/loans/workspace/WorkspaceStatus";
import { WorkspaceTasks } from "@/components/loans/workspace/WorkspaceTasks";
import { WorkspaceSubjectProperty } from "@/components/loans/workspace/WorkspaceSubjectProperty";
import { WorkspaceTitleLegal } from "@/components/loans/workspace/WorkspaceTitleLegal";
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
  const { effectiveRole } = useAuth();
  const rawSection = String(router.query.section ?? "");
  const section = resolveWorkspaceSection(rawSection);
  const [railOpen, setRailOpen] = useState(true);

  function goTo(next: WorkspaceSection) {
    // Use shallow routing so tab changes do not remount the full page shell.
    void router.push(
      { query: { loanId: loan.id, section: next } },
      undefined,
      { shallow: true },
    );
  }

  const riskMetric = loan.loanProgram === "dscr" ? "DSCR pending" : "DTI pending";
  const cmd = resolveCommandBar(loan);

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
            <button
              type="button"
              className={`activity-rail-toggle${railOpen ? " activity-rail-toggle--active" : ""}`}
              onClick={() => setRailOpen((o) => !o)}
              aria-label={railOpen ? "Hide activity" : "Show activity"}
              title={railOpen ? "Hide activity" : "Show activity"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="loan-cmd-strip" aria-label="Loan command summary">
          {cmd.blocker ? (
            <span className="loan-cmd-blocker">
              <span className="loan-cmd-dot" aria-hidden />
              {cmd.blocker}
            </span>
          ) : (
            <span className="loan-cmd-blocker loan-cmd-blocker--clear">
              <span className="loan-cmd-dot" aria-hidden />
              No blockers
            </span>
          )}
          <span className="loan-cmd-sep" aria-hidden>·</span>
          <span className={`loan-cmd-owner loan-cmd-owner--${cmd.ownerType}`}>
            {cmd.owner}
          </span>
          <button
            type="button"
            className="loan-cmd-action"
            onClick={() => goTo(cmd.nextActionSection)}
          >
            {cmd.nextAction} →
          </button>
        </div>
      </div>

      <div className={`loan-workspace-body${railOpen ? " has-activity-rail" : ""}`}>
        <LoanWorkspaceRail
          activeSection={section}
          loan={loan}
          role={effectiveRole}
          onSectionChange={goTo}
        />
        <div className="loan-workspace-content">
          <WorkspaceContent section={section} loan={loan} />
        </div>
        {railOpen && (
          <WorkspaceActivityRail
            loanId={loan.id}
            onClose={() => setRailOpen(false)}
          />
        )}
      </div>
    </>
  );
}

type CommandBar = {
  blocker: string | null;
  owner: string;
  ownerType: "internal" | "broker" | "borrower" | "none";
  nextAction: string;
  nextActionSection: WorkspaceSection;
};

function resolveCommandBar(loan: LoanSummary): CommandBar {
  const open = loan.conditionsOpen;
  const needed = loan.actionsNeeded;

  switch (loan.status) {
    case "new_draft":
      return { blocker: "Awaiting submission", owner: "Broker", ownerType: "broker", nextAction: "Start Submission", nextActionSection: "processing" };
    case "submitted":
      return { blocker: "Pending UW assignment", owner: "Account Executive", ownerType: "internal", nextAction: "Assign File", nextActionSection: "status" };
    case "conditions_review":
      if (open > 0) {
        return { blocker: `${open} open condition${open !== 1 ? "s" : ""}`, owner: "Processor", ownerType: "internal", nextAction: "Review Conditions", nextActionSection: "conditions" };
      }
      return { blocker: "Package complete — awaiting UW", owner: "Underwriter", ownerType: "internal", nextAction: "Underwrite File", nextActionSection: "underwriting" };
    case "approved_pending":
      return { blocker: needed > 0 ? `${needed} item${needed !== 1 ? "s" : ""} outstanding` : "Prior-to-doc conditions", owner: "Processor", ownerType: "internal", nextAction: "Clear Conditions", nextActionSection: "conditions" };
    case "approved":
      return { blocker: "Awaiting closing documents", owner: "Closer", ownerType: "internal", nextAction: "Prepare Closing", nextActionSection: "closing" };
    case "funded":
      return { blocker: null, owner: "Funder", ownerType: "internal", nextAction: "View Funding", nextActionSection: "funding" };
    case "closed":
    case "post_closing":
    case "archived":
      return { blocker: null, owner: "Post-Closing", ownerType: "none", nextAction: "View Audit", nextActionSection: "audit-log" };
    case "denied":
    case "withdrawn":
    case "cancelled":
      return { blocker: null, owner: "Closed", ownerType: "none", nextAction: "View Status", nextActionSection: "status" };
    default:
      return { blocker: null, owner: "Team", ownerType: "internal", nextAction: "Open File", nextActionSection: "home" };
  }
}

function WorkspaceContent({ section, loan }: { section: WorkspaceSection; loan: LoanSummary }) {
  if (section === "status") return <WorkspaceStatus loan={loan} />;
  if (section === "tasks")  return <WorkspaceTasks loan={loan} />;
  if (section === "home") return <WorkspaceHome loan={loan} />;
  if (section === "borrower-urla") return <WorkspaceBorrowerURLA loan={loan} />;
  if (section === "loan-estimate") return <WorkspaceLoanEstimate loan={loan} />;
  if (section === "conditions") return <WorkspaceConditions loan={loan} />;
  if (section === "exceptions") return <WorkspaceExceptions loan={loan} />;
  if (section === "underwriting") return <WorkspaceUnderwriting loan={loan} />;
  if (section === "processing") return <WorkspaceProcessing loan={loan} />;
  if (section === "parties") return <WorkspaceParties loan={loan} />;
  if (section === "income") return <WorkspaceIncome loan={loan} />;
  if (section === "subject-property") return <WorkspaceSubjectProperty loan={loan} />;
  if (section === "appraisal") return <WorkspaceAppraisal loan={loan} />;
  if (section === "credit") return <WorkspaceCredit loan={loan} />;
  if (section === "hmda") return <WorkspaceHMDA loan={loan} />;
  if (section === "documents") return <WorkspaceDocuments loan={loan} />;
  if (section === "escrow") return <WorkspaceEscrow loan={loan} />;
  if (section === "title-legal") return <WorkspaceTitleLegal loan={loan} />;
  if (section === "disclosures") return <WorkspaceDisclosures loan={loan} />;
  if (section === "funding") return <WorkspaceFunding loan={loan} />;
  if (section === "closing") return <WorkspaceClosing loan={loan} />;
  if (section === "conversation") return <WorkspaceConversation loan={loan} />;
  if (section === "audit-log") return <WorkspaceAuditLog loan={loan} />;
  return <WorkspaceHome loan={loan} />;
}
