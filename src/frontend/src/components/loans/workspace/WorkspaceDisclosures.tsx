import { useState } from "react";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type DisclosureTab = "prepare" | "review" | "send";

const TIMELINE = [
  { label: "Prepared", status: "complete", detail: "Disclosure desk prepared package", date: "Jun 3" },
  { label: "Generated", status: "complete", detail: "Forms generated from loan data", date: "Jun 3" },
  { label: "Sent", status: "complete", detail: "Sent by email delivery", date: "Jun 4" },
  { label: "Delivered", status: "complete", detail: "Borrower delivery confirmed", date: "Jun 4" },
  { label: "Viewed", status: "complete", detail: "Primary borrower viewed package", date: "Jun 5" },
  { label: "Signed", status: "pending", detail: "Co-borrower signature pending", date: "Pending" },
];

const PACKAGES = [
  {
    id: "pkg-1",
    name: "Initial Disclosure Package",
    type: "Initial Disclosure",
    forms: 18,
    recipient: "Primary Borrower",
    sentDate: "2026-06-04",
    signedDate: "Pending",
    completion: 74,
    status: "Partially signed",
  },
  {
    id: "pkg-2",
    name: "State Disclosures",
    type: "State Disclosure",
    forms: 5,
    recipient: "All Borrowers",
    sentDate: "2026-06-04",
    signedDate: "2026-06-05",
    completion: 100,
    status: "Complete",
  },
];

export function WorkspaceDisclosures({ loan }: Props) {
  const [tab, setTab] = useState<DisclosureTab>("prepare");
  const [selectedPackageId, setSelectedPackageId] = useState(PACKAGES[0].id);
  const selected = PACKAGES.find((item) => item.id === selectedPackageId) ?? PACKAGES[0];

  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>Workflow</span>
        <h2>Disclosures</h2>
        <p>Prepare, review, send, and monitor disclosure packages and TRID timing for {loan.loanNumber}.</p>
      </div>

      <div className="disclosures-layout">
        <div className="workspace-panel-stack">
          <section className="workspace-panel">
            <h3>Disclosure Timeline</h3>
            <div className="workspace-timeline">
              {TIMELINE.map((event) => (
                <div key={event.label} className={`workspace-timeline-step workspace-timeline-step--${event.status}`}>
                  <span />
                  <div>
                    <strong>{event.label}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <time>{event.date}</time>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-panel">
            <h3>Packages</h3>
            <div className="disclosure-package-list">
              {PACKAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`disclosure-package-row${selectedPackageId === item.id ? " disclosure-package-row--active" : ""}`}
                  onClick={() => setSelectedPackageId(item.id)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.type} / {item.forms} forms / {item.recipient}</small>
                  </span>
                  <span>{item.completion}%</span>
                  <StatusPill status={item.status} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="workspace-panel disclosure-workspace-panel">
          <div className="workspace-panel-header">
            <span>{selected.name}</span>
            <strong>{selected.status}</strong>
          </div>
          <div className="workspace-subtabs">
            {(["prepare", "review", "send"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={tab === item ? "workspace-subtab workspace-subtab--active" : "workspace-subtab"}
                onClick={() => setTab(item)}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {tab === "prepare" && (
            <div className="disclosure-tab-content">
              <h3>Prepare Package</h3>
              <ChecklistItem label="Loan Estimate" status="Ready" />
              <ChecklistItem label="State-specific forms" status="Ready" />
              <ChecklistItem label="Intent to proceed" status="Missing field" warning />
              <button type="button" className="workspace-primary-button">Generate Package</button>
            </div>
          )}

          {tab === "review" && (
            <div className="disclosure-tab-content">
              <h3>Review Package</h3>
              <div className="documents-preview-box">
                <span>Preview</span>
                <strong>Disclosure package preview placeholder</strong>
                <p>Forms included: {selected.forms}</p>
              </div>
            </div>
          )}

          {tab === "send" && (
            <div className="disclosure-tab-content">
              <h3>Send Package</h3>
              <label className="workspace-field">
                <span>Recipients</span>
                <input value={selected.recipient} readOnly />
              </label>
              <label className="workspace-field">
                <span>Delivery Method</span>
                <input value="Email and borrower portal" readOnly />
              </label>
              <button type="button" className="workspace-primary-button">Send Package</button>
            </div>
          )}
        </section>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Compliance</span>
            <strong>TRID</strong>
          </div>
          <StatusLine label="TRID clock" value="Day 2 of 3" tone="warning" />
          <StatusLine label="Earliest closing" value="Jun 18, 2026" tone="success" />
          <StatusLine label="Waiting period" value="Active" tone="warning" />
          <div className="workspace-validation-group">
            <h4>Missing Signatures</h4>
            <p className="workspace-warning-text">Co-borrower signature pending on initial package.</p>
          </div>
          <div className="workspace-validation-group">
            <h4>Outstanding Redisclosures</h4>
            <p className="workspace-clear-text">No redisclosure package required.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChecklistItem({ label, status, warning = false }: { label: string; status: string; warning?: boolean }) {
  return (
    <div className="workspace-checklist-row">
      <span>{label}</span>
      <strong className={warning ? "workspace-warning-text" : "workspace-clear-text"}>{status}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "Complete" ? "success" : "warning";
  return <span className={`workspace-pill workspace-pill--${tone}`}>{status}</span>;
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" }) {
  return (
    <div className={`workspace-status-line workspace-status-line--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
