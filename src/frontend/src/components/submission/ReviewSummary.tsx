import { formatCurrency } from "@/lib/utils";
import { submissionSteps } from "@/data/submissionConfig";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import { validateSubmission } from "@/services/submissionValidation";

export function ReviewSummary() {
  const draft = useLoanSubmissionStore((state) => state.draft);
  const checklist = useDocumentStore((state) => state.checklist);
  const validation = validateSubmission(draft);
  const blocking = validation.filter((error) => error.severity === "blocking");
  const warnings = validation.filter((error) => error.severity === "warning");
  const missingDocs = checklist.filter(
    (item) => item.requirement === "required" && item.uploadStatus === "not_started",
  );

  return (
    <div className="review-grid fade-slide-in">
      <section className="panel">
        <div className="panel-heading">
          <h3>Application Summary</h3>
          <span>{draft.loanId ?? "Draft"}</span>
        </div>
        <div className="definition-list">
          <div>
            <dt>Loan Amount</dt>
            <dd>{formatCurrency(draft.setup.loanAmount ?? 0)}</dd>
          </div>
          <div>
            <dt>Property</dt>
            <dd>{draft.property.city || "Pending"}, {draft.property.state || "—"}</dd>
          </div>
          <div>
            <dt>Borrower</dt>
            <dd>{draft.borrowers[0]?.firstName || "Pending"} {draft.borrowers[0]?.lastName}</dd>
          </div>
          <div>
            <dt>Selected Scenario</dt>
            <dd>{draft.selectedScenarioId ?? "Not selected"}</dd>
          </div>
        </div>
        <div className="status-list">
          {submissionSteps.map((step) => (
            <div className="status-row" key={step.id}>
              <div>
                <strong>{step.label}</strong>
                <span>{step.subtitle}</span>
              </div>
              <p>{draft.stepCompleteness[step.id]}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="panel readiness-panel">
        <div className="panel-heading">
          <h3>Submission Readiness</h3>
        </div>
        <ReadinessGroup title="Blocking" tone="blocking" items={[...blocking.map((error) => error.message), ...missingDocs.map((doc) => `${doc.label} not uploaded`)]} />
        <ReadinessGroup title="Warnings" tone="warning" items={warnings.map((error) => error.message)} />
        <ReadinessGroup
          title="Ready"
          tone="ready"
          items={[
            "Borrower data structure is complete",
            "Property details are captured",
            "Pricing scenario can travel with submission",
          ]}
        />
        <p className="muted integration-note">
          TODO: AUS Integration and Credit Vendor Integration will add structured findings here.
        </p>
      </section>
    </div>
  );
}

function ReadinessGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "blocking" | "warning" | "ready";
  items: string[];
}) {
  return (
    <div className={`readiness-group ${tone}`}>
      <strong>{title}</strong>
      {items.length ? (
        items.map((item) => <span key={item}>{item}</span>)
      ) : (
        <span>None</span>
      )}
    </div>
  );
}
