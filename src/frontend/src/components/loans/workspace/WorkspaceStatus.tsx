import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";
import type { LoanStatusOut, StatusEventOut } from "@/types/api";

type Props = { loan: LoanSummary };

const STATUS_LABELS: Record<string, string> = {
  new_draft:         "New Draft",
  submitted:         "Submitted",
  conditions_review: "Conditions Review",
  approved_pending:  "Approved — Pending",
  approved:          "Approved",
  funded:            "Funded",
  closed:            "Closed",
  post_closing:      "Post-Closing",
  archived:          "Archived",
  denied:            "Denied",
  withdrawn:         "Withdrawn",
  cancelled:         "Cancelled",
};

function statusTone(s: string) {
  if (["approved", "funded", "closed"].includes(s)) return "green";
  if (["denied", "withdrawn", "cancelled"].includes(s)) return "red";
  if (["conditions_review", "approved_pending"].includes(s)) return "amber";
  return "blue";
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function WorkspaceStatus({ loan }: Props) {
  const { token } = useAuth();
  const [statusOut, setStatusOut] = useState<LoanStatusOut | null>(null);
  const [history, setHistory] = useState<StatusEventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<LoanStatusOut>(`/loans/${loan.id}/status`, { token }),
      apiRequest<StatusEventOut[]>(`/loans/${loan.id}/status/history`, { token }),
    ])
      .then(([s, h]) => {
        if (!cancelled) { setStatusOut(s); setHistory(h); }
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  async function handleTransition(toStatus: string) {
    if (!token) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await apiRequest(`/loans/${loan.id}/status/transition`, {
        token,
        method: "POST",
        body: JSON.stringify({ to_status: toStatus, reason: reason || null }),
      });
      const [s, h] = await Promise.all([
        apiRequest<LoanStatusOut>(`/loans/${loan.id}/status`, { token }),
        apiRequest<StatusEventOut[]>(`/loans/${loan.id}/status/history`, { token }),
      ]);
      setStatusOut(s);
      setHistory(h);
      setConfirming(null);
      setReason("");
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="ws-status-wrapper">
      <div className="ws-status-bar">
        <h2 className="ws-save-bar-title">Loan Status</h2>
        <span className="ws-save-bar-subtitle">{loan.loanNumber}</span>
      </div>

      <div className="ws-status-content">
        {loading && <div className="ws-status-loading">Loading status…</div>}
        {error && <div className="ws-status-error">{error}</div>}

        {statusOut && (
          <>
            {/* Current status card */}
            <section className="ws-status-section">
              <h3 className="ws-status-section-title">Current Status</h3>
              <div className="ws-status-current-card">
                <div className={`ws-status-badge ws-status-badge--${statusTone(statusOut.current_status)}`}>
                  {statusOut.current_status_label}
                </div>
                {statusOut.is_terminal && (
                  <span className="ws-status-terminal-tag">Terminal — no further transitions allowed</span>
                )}
              </div>
            </section>

            {/* Available transitions */}
            {!statusOut.is_terminal && statusOut.available_transitions.length > 0 && (
              <section className="ws-status-section">
                <h3 className="ws-status-section-title">Move File To</h3>
                <div className="ws-status-transitions">
                  {statusOut.available_transitions.map((t) => (
                    <button
                      key={t.status}
                      type="button"
                      className={`ws-status-transition-btn ws-status-transition-btn--${statusTone(t.status)}`}
                      onClick={() => { setConfirming(t.status); setReason(""); setTransitionError(null); }}
                      disabled={transitioning}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Confirm modal */}
            {confirming && (
              <div className="ws-status-confirm-overlay">
                <div className="ws-status-confirm-modal">
                  <h4>Confirm Status Change</h4>
                  <p>
                    Move <strong>{statusOut.current_status_label}</strong> →{" "}
                    <strong>{STATUS_LABELS[confirming] ?? confirming}</strong>?
                  </p>
                  <label className="ws-status-confirm-label">
                    Reason <span className="ws-status-optional">(optional)</span>
                    <textarea
                      className="ws-status-confirm-textarea"
                      rows={2}
                      placeholder="Briefly describe the reason for this change…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  {transitionError && <div className="ws-status-transition-error">{transitionError}</div>}
                  <div className="ws-status-confirm-actions">
                    <button
                      type="button"
                      className="ws-status-confirm-cancel"
                      onClick={() => setConfirming(null)}
                      disabled={transitioning}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`ws-status-confirm-ok ws-status-confirm-ok--${statusTone(confirming)}`}
                      onClick={() => handleTransition(confirming)}
                      disabled={transitioning}
                    >
                      {transitioning ? "Moving…" : `Move to ${STATUS_LABELS[confirming] ?? confirming}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Status history */}
        <section className="ws-status-section">
          <h3 className="ws-status-section-title">Status History</h3>
          {history.length === 0 && !loading && (
            <div className="ws-status-empty">No status events recorded yet.</div>
          )}
          <ol className="ws-status-timeline">
            {history.map((evt) => (
              <li key={evt.id} className="ws-status-event">
                <div className="ws-status-event-dot" />
                <div className="ws-status-event-body">
                  <div className="ws-status-event-label">
                    {evt.from_status
                      ? <>{STATUS_LABELS[evt.from_status] ?? evt.from_status} <span className="ws-status-arrow">→</span> {STATUS_LABELS[evt.to_status] ?? evt.to_status}</>
                      : <>Created as {STATUS_LABELS[evt.to_status] ?? evt.to_status}</>
                    }
                  </div>
                  {evt.reason && <div className="ws-status-event-reason">{evt.reason}</div>}
                  <time className="ws-status-event-time">{fmtDate(evt.occurred_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
