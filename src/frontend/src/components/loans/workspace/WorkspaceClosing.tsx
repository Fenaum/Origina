import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const CLOSING_STEPS = [
  { label: "Closing package requested", status: "complete", date: "Jun 7" },
  { label: "Title final review", status: "complete", date: "Jun 8" },
  { label: "CD waiting period", status: "active", date: "In progress" },
  { label: "Docs out", status: "pending", date: "Pending" },
  { label: "Signed package returned", status: "pending", date: "Pending" },
];

export function WorkspaceClosing({ loan }: Props) {
  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>Loan File</span>
        <h2>Closing</h2>
        <p>Coordinate closing disclosure timing, document package status, signing milestones, and final package return for {loan.loanNumber}.</p>
      </div>

      <div className="workspace-two-column">
        <section className="workspace-panel">
          <h3>Closing Timeline</h3>
          <div className="workspace-timeline">
            {CLOSING_STEPS.map((step) => (
              <div key={step.label} className={`workspace-timeline-step workspace-timeline-step--${step.status}`}>
                <span />
                <div>
                  <strong>{step.label}</strong>
                </div>
                <time>{step.date}</time>
              </div>
            ))}
          </div>
        </section>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Closing Control</span>
            <strong>CD Active</strong>
          </div>
          <StatusLine label="Earliest close" value="Jun 18, 2026" tone="success" />
          <StatusLine label="Docs out" value="Pending" tone="warning" />
          <StatusLine label="Signing appointment" value="Not scheduled" tone="warning" />
          <StatusLine label="Package returned" value="No" tone="warning" />
          <button type="button" className="workspace-primary-button">Prepare Closing Package</button>
        </aside>
      </div>
    </div>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" }) {
  return (
    <div className={`workspace-status-line workspace-status-line--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
