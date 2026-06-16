import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";
import type { CreditReportOut, CreditLiabilityOut, CreditEventOut } from "@/types/api";

type Props = { loan: LoanSummary };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmtMoney(v: number | null | undefined) {
  return v != null ? money.format(v) : "—";
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function scoreTone(score: number | null | undefined) {
  if (score == null) return "";
  if (score >= 740) return "ws-credit-score--green";
  if (score >= 680) return "ws-credit-score--blue";
  if (score >= 620) return "ws-credit-score--amber";
  return "ws-credit-score--red";
}

const EVENT_LABELS: Record<string, string> = {
  bankruptcy: "Bankruptcy",
  foreclosure: "Foreclosure",
  short_sale: "Short Sale",
  deed_in_lieu: "Deed in Lieu",
  charge_off: "Charge-Off",
  collection: "Collection",
  late_payment: "Late Payment",
  judgment: "Judgment",
  other: "Other",
};

export function WorkspaceCredit({ loan }: Props) {
  const { token } = useAuth();
  const [reports, setReports] = useState<CreditReportOut[]>([]);
  const [liabilities, setLiabilities] = useState<CreditLiabilityOut[]>([]);
  const [events, setEvents] = useState<CreditEventOut[]>([]);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      apiRequest<CreditReportOut[]>(`/credit/reports?loan_id=${loan.id}`, { token }),
      apiRequest<CreditLiabilityOut[]>(`/credit/liabilities?loan_id=${loan.id}`, { token }),
      apiRequest<CreditEventOut[]>(`/credit/events?loan_id=${loan.id}`, { token }),
    ])
      .then(([r, l, e]) => {
        if (!cancelled) { setReports(r); setLiabilities(l); setEvents(e); }
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const active = reports.find((r) => r.is_active) ?? reports[0] ?? null;
  const totalBalance = liabilities.filter((l) => !l.is_excluded).reduce((s, l) => s + (l.balance ?? 0), 0);
  const totalPayments = liabilities.filter((l) => !l.is_excluded).reduce((s, l) => s + (l.monthly_payment ?? 0), 0);

  return (
    <div className="credit-wrapper">
      <div className="ws-status-bar">
        <h2 className="ws-save-bar-title">Credit</h2>
        <span className="ws-save-bar-subtitle">{loan.loanNumber}</span>
      </div>

      {loading && <div className="credit-loading">Loading credit data…</div>}
      {error && <div className="credit-error">{error}</div>}

      {!loading && (
        <div className="credit-content">
          {/* Score cards */}
          <section className="credit-section">
            <h3 className="credit-section-title">Credit Scores</h3>
            {!active ? (
              <div className="credit-empty">No credit report on file.</div>
            ) : (
              <div className="credit-score-row">
                <ScoreCard label="Equifax" score={active.equifax_score} />
                <ScoreCard label="Experian" score={active.experian_score} />
                <ScoreCard label="TransUnion" score={active.transunion_score} />
                <ScoreCard label="Middle Score" score={active.middle_score} featured />
                <ScoreCard label="Rep Score" score={active.rep_score} featured />
              </div>
            )}
            {active && (
              <div className="credit-report-meta">
                <span>Report Date: {fmtDate(active.report_date)}</span>
                {active.vendor && <span>Vendor: {active.vendor}</span>}
                {active.reference_number && <span>Ref: {active.reference_number}</span>}
              </div>
            )}
          </section>

          {/* Liabilities */}
          <section className="credit-section">
            <h3 className="credit-section-title">Liabilities</h3>
            {liabilities.length === 0 ? (
              <div className="credit-empty">No liabilities on file.</div>
            ) : (
              <>
                <div className="credit-liability-summary">
                  <div className="credit-summary-item">
                    <span>Total Balance</span>
                    <strong>{fmtMoney(totalBalance)}</strong>
                  </div>
                  <div className="credit-summary-item">
                    <span>Monthly Payments</span>
                    <strong>{fmtMoney(totalPayments)}</strong>
                  </div>
                  <div className="credit-summary-item">
                    <span>Open Tradelines</span>
                    <strong>{liabilities.filter((l) => !l.is_excluded).length}</strong>
                  </div>
                  <div className="credit-summary-item">
                    <span>Excluded</span>
                    <strong>{liabilities.filter((l) => l.is_excluded).length}</strong>
                  </div>
                </div>
                <div className="credit-liab-table-wrap">
                  <table className="credit-liab-table">
                    <thead>
                      <tr>
                        <th>Creditor</th>
                        <th>Type</th>
                        <th>Acct</th>
                        <th>Balance</th>
                        <th>Payment</th>
                        <th>Limit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liabilities.map((l) => (
                        <tr key={l.id} className={l.is_excluded ? "credit-liab-excluded" : ""}>
                          <td>{l.creditor_name ?? "—"}</td>
                          <td>{l.tradeline_type ?? "—"}</td>
                          <td>…{l.account_number_last4 ?? "—"}</td>
                          <td>{fmtMoney(l.balance)}</td>
                          <td>{fmtMoney(l.monthly_payment)}</td>
                          <td>{fmtMoney(l.credit_limit)}</td>
                          <td>
                            {l.is_excluded && <span className="credit-tag credit-tag--excluded">Excluded</span>}
                            {l.paid_at_closing && <span className="credit-tag credit-tag--paid">Paid at Close</span>}
                            {!l.is_excluded && !l.paid_at_closing && <span className="credit-tag credit-tag--open">Open</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Derogatory events */}
          <section className="credit-section">
            <h3 className="credit-section-title">Derogatory Events</h3>
            {events.length === 0 ? (
              <div className="credit-empty">No derogatory events recorded.</div>
            ) : (
              <div className="credit-events-list">
                {events.map((evt) => (
                  <article key={evt.id} className="credit-event-card">
                    <div className="credit-event-type">{EVENT_LABELS[evt.event_type] ?? evt.event_type}</div>
                    <div className="credit-event-meta">
                      {evt.event_date && <span>Date: {fmtDate(evt.event_date)}</span>}
                      {evt.discharged_date && <span>Discharged: {fmtDate(evt.discharged_date)}</span>}
                      {evt.months_since != null && <span>{evt.months_since} months ago</span>}
                    </div>
                    {evt.explanation && <p className="credit-event-explanation">{evt.explanation}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label, score, featured = false,
}: {
  label: string; score: number | null | undefined; featured?: boolean;
}) {
  return (
    <div className={`credit-score-card${featured ? " credit-score-card--featured" : ""}`}>
      <span className="credit-score-label">{label}</span>
      <strong className={`ws-credit-score ${scoreTone(score)}`}>
        {score ?? "—"}
      </strong>
    </div>
  );
}
