import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const AUDIT_EVENTS = [
  {
    id: "audit-1",
    event: "Submission completed",
    actor: "Broker Portal",
    source: "submission",
    field: "loan.status",
    before: "New Draft",
    after: "Submitted",
    time: "2026-06-04 09:42 AM",
  },
  {
    id: "audit-2",
    event: "Document uploaded",
    actor: "Morgan Lee",
    source: "documents",
    field: "documents.file_name",
    before: "-",
    after: "bank-statements-jan-mar.pdf",
    time: "2026-06-05 01:18 PM",
  },
  {
    id: "audit-3",
    event: "Condition created",
    actor: "Avery Brooks",
    source: "conditions",
    field: "conditions.status",
    before: "-",
    after: "Open",
    time: "2026-06-05 02:03 PM",
  },
  {
    id: "audit-4",
    event: "Financial calculation updated",
    actor: "Avery Brooks",
    source: "financial_analysis",
    field: "asset_allocations.amount_used",
    before: "$120,000",
    after: "$150,000",
    time: "2026-06-06 10:16 AM",
  },
];

export function WorkspaceAuditLog({ loan }: Props) {
  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>System</span>
        <h2>Audit Log</h2>
        <p>System-focused event history for material file changes, submissions, documents, disclosures, and calculations on {loan.loanNumber}.</p>
      </div>

      <div className="workspace-summary-strip">
        <SummaryCard label="Events" value={String(AUDIT_EVENTS.length)} />
        <SummaryCard label="Material Changes" value="3" />
        <SummaryCard label="Sources" value="4" />
        <SummaryCard label="Export" value="Ready" />
      </div>

      <section className="workspace-panel">
        <div className="documents-grid-header">
          <h3>Event History</h3>
          <div>
            <button type="button">Filter</button>
            <button type="button">Export</button>
          </div>
        </div>

        <div className="audit-table">
          <div className="audit-table-row audit-table-row--head">
            <span>Event</span>
            <span>Actor</span>
            <span>Field</span>
            <span>Before</span>
            <span>After</span>
            <span>Time</span>
          </div>
          {AUDIT_EVENTS.map((event) => (
            <div key={event.id} className="audit-table-row">
              <span>
                <strong>{event.event}</strong>
                <small>{event.source}</small>
              </span>
              <span>{event.actor}</span>
              <span>{event.field}</span>
              <span>{event.before}</span>
              <span>{event.after}</span>
              <span>{event.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
