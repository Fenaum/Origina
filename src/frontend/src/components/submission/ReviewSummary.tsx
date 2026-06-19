import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { submissionSteps } from "@/data/submissionConfig";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import { validateSubmission } from "@/services/submissionValidation";
import { useAuth } from "@/state/auth";
import type { ExceptionOut } from "@/types/api";
import { STATUS_LABELS, STATUS_CLASS, SEVERITY_CLASS, SEVERITY_LABELS } from "@/lib/exceptionConstants";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

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
      <PreFileExceptionsSection loanId={draft.loanId} />
    </div>
  );
}

// ── PreFileExceptionsSection ──────────────────────────────────────────────────

function PreFileExceptionsSection({ loanId }: { loanId: string | null }) {
  const { token } = useAuth();
  const [exceptions, setExceptions] = useState<ExceptionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch(`${API_BASE}/exceptions/?exception_source=pre_file&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() as Promise<ExceptionOut[]> : [])
      .then(setExceptions)
      .catch(() => {/* ignore — non-blocking */})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return null;
  if (exceptions.length === 0) return null;

  const approved = exceptions.filter(
    (e) => e.status === "approved" || e.status === "approved_with_conditions",
  );
  const pending = exceptions.filter((e) =>
    ["submitted", "assigned", "under_review", "additional_info_requested"].includes(e.status),
  );
  const denied = exceptions.filter((e) => e.status === "denied");

  if (approved.length === 0 && pending.length === 0 && denied.length === 0) return null;

  async function attach(excId: string) {
    if (!loanId || !token) return;
    setLinking(excId);
    setLinkError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/${excId}/link-loan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: loanId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Failed to attach");
      }
      const updated = await res.json() as ExceptionOut;
      setExceptions((prev) => prev.map((e) => e.id === excId ? updated : e));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setLinking(null);
    }
  }

  return (
    <section className="panel preexc-review-section">
      <div className="panel-heading">
        <h3>Pre-File Exceptions</h3>
        {approved.length > 0 && (
          <span className="preexc-review-badge">{approved.length} approved</span>
        )}
      </div>

      {linkError && <p className="preexc-review-error">{linkError}</p>}

      {approved.length > 0 && (
        <div className="preexc-review-group">
          <p className="preexc-review-group-label">Approved — ready to attach</p>
          {approved.map((exc) => {
            const alreadyLinked = exc.loan_id === loanId;
            return (
              <div key={exc.id} className="preexc-review-item">
                <div className="preexc-review-item-meta">
                  <span className={`exc-badge ${STATUS_CLASS[exc.status]}`}>
                    {STATUS_LABELS[exc.status]}
                  </span>
                  <span className={`exc-sev ${SEVERITY_CLASS[exc.severity]}`}>
                    {SEVERITY_LABELS[exc.severity]}
                  </span>
                  <span className="preexc-review-item-title">{exc.title}</span>
                </div>
                {alreadyLinked ? (
                  <span className="preexc-review-attached">Attached ✓</span>
                ) : loanId ? (
                  <button
                    className="preexc-review-attach-btn"
                    type="button"
                    disabled={linking === exc.id}
                    onClick={() => void attach(exc.id)}
                  >
                    {linking === exc.id ? "Attaching…" : "Attach to Loan"}
                  </button>
                ) : (
                  <span className="preexc-review-no-loan">Save loan first to attach</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="preexc-review-group preexc-review-group--warning">
          <p className="preexc-review-group-label">Pending review</p>
          {pending.map((exc) => (
            <div key={exc.id} className="preexc-review-item preexc-review-item--pending">
              <span className={`exc-badge ${STATUS_CLASS[exc.status]}`}>
                {STATUS_LABELS[exc.status]}
              </span>
              <span className="preexc-review-item-title">{exc.title}</span>
            </div>
          ))}
        </div>
      )}

      {denied.length > 0 && (
        <div className="preexc-review-group preexc-review-group--denied">
          <p className="preexc-review-group-label">Denied</p>
          {denied.map((exc) => (
            <div key={exc.id} className="preexc-review-item preexc-review-item--denied">
              <span className={`exc-badge ${STATUS_CLASS[exc.status]}`}>
                {STATUS_LABELS[exc.status]}
              </span>
              <span className="preexc-review-item-title">{exc.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
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
