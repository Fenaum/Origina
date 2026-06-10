import { useInView } from "@/hooks/useInView";

const features = [
  {
    title: "Streamlined Partner Sign-Up",
    description:
      "Fast broker onboarding with license verification and document collection handled in one flow.",
  },
  {
    title: "Scenario & Pricing Workflow",
    description:
      "Run multiple pricing scenarios, compare rate options, and share them with borrowers directly from the portal.",
  },
  {
    title: "Upload and Track Every File",
    description:
      "Drop documents, monitor conditions, and see exactly where each loan stands — from submission to funding.",
  },
  {
    title: "Reduce Back-and-Forth",
    description:
      "Conditions, notes, and approvals in one place. Less email, fewer calls, faster closings.",
  },
  {
    title: "Modern TPO Portal Experience",
    description:
      "A purpose-built interface for Non-QM wholesale — not a retrofitted legacy LOS.",
  },
];

const previewRows = [
  {
    name: "M. Yamamoto",
    note: "DSCR / AZ",
    program: "DSCR",
    amount: "$1.57M",
    badge: "review" as const,
    label: "Conditions",
  },
  {
    name: "A. Carter",
    note: "Jumbo / CO",
    program: "Jumbo NQM",
    amount: "$2.32M",
    badge: "review" as const,
    label: "Conditions",
  },
  {
    name: "E. Park",
    note: "Bank Stmt / CA",
    program: "Bank Stmt",
    amount: "$743K",
    badge: "submitted" as const,
    label: "Submitted",
  },
  {
    name: "A. Lee",
    note: "Bank Stmt / CO",
    program: "Bank Stmt",
    amount: "$519K",
    badge: "funded" as const,
    label: "Funded",
  },
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2.5 7.5l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrokerSection() {
  const { ref, visible } = useInView<HTMLElement>();

  return (
    <section
      id="brokers"
      className="mkt-section dark"
      ref={ref}
    >
      <div className="mkt-section-inner">
        <div className="mkt-broker-layout">
          <div>
            <div className={`mkt-section-header mkt-reveal${visible ? " visible" : ""}`}>
              <span className="mkt-eyebrow-pill">For Brokers</span>
              <h2>A TPO platform built<br />for the way you work.</h2>
              <p>
                Stop managing loan files across email chains and spreadsheets.
                Origina gives wholesale mortgage brokers a single, modern
                workspace for every file.
              </p>
            </div>

            <div className={`mkt-broker-features mkt-reveal delay-1${visible ? " visible" : ""}`}>
              {features.map((f) => (
                <div key={f.title} className="mkt-broker-feature">
                  <div className="mkt-broker-check" aria-hidden>
                    <CheckIcon />
                  </div>
                  <div>
                    <h4>{f.title}</h4>
                    <p>{f.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "2.5rem" }}>
              <button
                className="mkt-btn-primary"
                type="button"
                onClick={() => console.log("Broker portal — coming soon")}
              >
                Explore Broker Portal →
              </button>
            </div>
          </div>

          <div className={`mkt-reveal delay-2${visible ? " visible" : ""}`}>
            <div className="mkt-platform-preview" aria-label="Platform preview">
              <div className="mkt-preview-titlebar">
                <span className="mkt-preview-dot red" />
                <span className="mkt-preview-dot yellow" />
                <span className="mkt-preview-dot green" />
                <span className="mkt-preview-title-text">Origina — Loan Pipeline</span>
              </div>

              <div className="mkt-preview-body">
                <div className="mkt-preview-header">
                  <span>Borrower</span>
                  <span>Program</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {previewRows.map((row) => (
                  <div key={row.name} className="mkt-preview-row">
                    <div className="mkt-preview-row-name">
                      {row.name}
                      <small>{row.note}</small>
                    </div>
                    <span className="mkt-preview-row-program">{row.program}</span>
                    <span className="mkt-preview-row-amount">{row.amount}</span>
                    <span className={`mkt-preview-badge ${row.badge}`}>{row.label}</span>
                  </div>
                ))}
              </div>

              <div className="mkt-preview-metrics">
                <div className="mkt-preview-metric">
                  <strong>24</strong>
                  <span>Active files</span>
                </div>
                <div className="mkt-preview-metric">
                  <strong>$38M</strong>
                  <span>Pipeline vol.</span>
                </div>
                <div className="mkt-preview-metric">
                  <strong>7</strong>
                  <span>In conditions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
