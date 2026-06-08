const steps = [
  { label: "Profile", state: "Complete" },
  { label: "Property", state: "Complete" },
  { label: "Income", state: "In progress" },
  { label: "Assets", state: "Not started" },
  { label: "Declarations", state: "Not started" },
  { label: "Review", state: "Not started" },
];

export function ApplicationProgress() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Application Progress</h3>
        <span>62% complete</span>
      </div>
      <div className="progress-track" aria-label="Borrower application progress">
        <div className="progress-fill" />
      </div>
      <div className="status-list">
        {steps.map((step) => (
          <div className="status-row" key={step.label}>
            <div>
              <strong>{step.label}</strong>
              <span>Borrower intake</span>
            </div>
            <p>{step.state}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
