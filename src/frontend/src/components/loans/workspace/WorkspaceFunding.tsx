import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const FUNDING_CHECKLIST = [
  { label: "Clear to fund approval", status: "Pending", tone: "warning" },
  { label: "Wire instructions verified", status: "Ready", tone: "success" },
  { label: "Warehouse line selected", status: "Pending", tone: "warning" },
  { label: "Final conditions cleared", status: "Blocked", tone: "danger" },
  { label: "Funding authorization", status: "Not started", tone: "neutral" },
];

export function WorkspaceFunding({ loan }: Props) {
  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>Loan File</span>
        <h2>Funding</h2>
        <p>Track funding readiness, wire details, warehouse routing, final checks, and authorization for {loan.loanNumber}.</p>
      </div>

      <div className="workspace-two-column">
        <div className="workspace-panel-stack">
          <section className="workspace-panel">
            <h3>Funding Readiness</h3>
            <div className="workspace-checklist">
              {FUNDING_CHECKLIST.map((item) => (
                <div key={item.label} className="workspace-checklist-row">
                  <span>{item.label}</span>
                  <strong className={`workspace-tone-${item.tone}`}>{item.status}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-panel">
            <h3>Wire & Warehouse</h3>
            <div className="workspace-form-grid">
              <ReadOnlyField label="Escrow Company" value="Northstar Escrow" />
              <ReadOnlyField label="Wire Verification" value="Callback pending" />
              <ReadOnlyField label="Warehouse Line" value="TBD" />
              <ReadOnlyField label="Funding Date" value="Pending CTC" />
            </div>
          </section>
        </div>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Status</span>
            <strong>Not Ready</strong>
          </div>
          <StatusLine label="Open blockers" value="2" tone="warning" />
          <StatusLine label="Final docs" value="Pending" tone="warning" />
          <StatusLine label="Wire verified" value="No" tone="warning" />
          <button type="button" className="workspace-primary-button">Request Funding Review</button>
        </aside>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
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
