const PROCESSING_STEPS = [
  "Validating application",
  "Creating loan file",
  "Assigning workflow",
  "Finalizing submission",
];

export function SubmissionProcessingOverlay({ activeStep }: { activeStep: number }) {
  return (
    <div className="submission-processing-overlay" role="status" aria-live="polite">
      <div className="submission-processing-panel">
        <div className="submission-processing-orb">
          <span />
        </div>
        <div>
          <p className="eyebrow">Submission in progress</p>
          <h3>Preparing your loan file</h3>
          <p className="submission-processing-copy">
            We are completing the final checks and moving this submission into the workflow.
          </p>
        </div>
        <div className="submission-processing-list">
          {PROCESSING_STEPS.map((label, index) => {
            const state =
              index < activeStep ? "complete" : index === activeStep ? "active" : "pending";
            return (
              <div key={label} className={`submission-processing-step ${state}`}>
                <span className="submission-processing-dot" />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
