import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { LoanTermsOut } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

// ── TRID Tolerance Categories ────────────────────────────────────────────────

type Tolerance = "zero" | "ten_pct" | "none";

type FeeLine = {
  label: string;
  amount: number | null;
  estimated: boolean;
};

type FeeSection = {
  id: string;
  sectionLabel: string;
  title: string;
  tolerance: Tolerance;
  lines: FeeLine[];
};

// ── Monthly P&I Calculator ────────────────────────────────────────────────────

function calcMonthlyPI(
  principal: number,
  annualRate: number,
  termMonths: number,
  amortType: string | null,
): number {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  if (amortType === "interest_only") return principal * r;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

// ── TRID Fee Estimator (derived from loan amount) ─────────────────────────────
// All estimates are flagged clearly. Actual line items should be entered by AE.

function buildFeeSections(loanAmount: number, annualRate: number): FeeSection[] {
  const origPct = 0.01; // 1% origination — typical Non-QM wholesale
  const titlePct = 0.004; // 0.4% lender's title insurance — Non-QM premium

  return [
    {
      id: "A",
      sectionLabel: "A",
      title: "Origination Charges",
      tolerance: "zero",
      lines: [
        { label: "Origination Fee (1.00%)", amount: Math.round(loanAmount * origPct), estimated: true },
        { label: "Processing Fee", amount: 1295, estimated: true },
        { label: "Underwriting Fee", amount: 995, estimated: true },
        { label: "Administration Fee", amount: null, estimated: true },
      ],
    },
    {
      id: "B",
      sectionLabel: "B",
      title: "Services — Borrower Did Not Shop For",
      tolerance: "zero",
      lines: [
        { label: "Appraisal Fee", amount: 750, estimated: true },
        { label: "Credit Report", amount: 45, estimated: true },
        { label: "Flood Determination", amount: 25, estimated: true },
        { label: "Tax Service Fee", amount: 85, estimated: true },
      ],
    },
    {
      id: "C",
      sectionLabel: "C",
      title: "Services — Borrower Can Shop For",
      tolerance: "ten_pct",
      lines: [
        { label: "Title Search", amount: 350, estimated: true },
        { label: "Title Examination", amount: 200, estimated: true },
        { label: "Lender's Title Insurance", amount: Math.round(loanAmount * titlePct), estimated: true },
        { label: "Settlement / Closing Fee", amount: 500, estimated: true },
      ],
    },
    {
      id: "E",
      sectionLabel: "E",
      title: "Taxes and Other Government Fees",
      tolerance: "ten_pct",
      lines: [
        { label: "Recording Fees", amount: 125, estimated: true },
        { label: "Transfer Taxes", amount: null, estimated: true },
      ],
    },
    {
      id: "F",
      sectionLabel: "F",
      title: "Prepaids",
      tolerance: "none",
      lines: [
        {
          label: "Prepaid Interest (15 days)",
          amount: annualRate > 0
            ? Math.round((loanAmount * annualRate) / 24)
            : null,
          estimated: true,
        },
        { label: "Homeowners Insurance Premium (1 yr)", amount: null, estimated: true },
        { label: "Mortgage Insurance Premium", amount: null, estimated: true },
      ],
    },
    {
      id: "G",
      sectionLabel: "G",
      title: "Initial Escrow Payment at Closing",
      tolerance: "none",
      lines: [
        { label: "Homeowners Insurance (2 mo.)", amount: null, estimated: true },
        { label: "Property Taxes (2 mo.)", amount: null, estimated: true },
        { label: "Mortgage Insurance (2 mo.)", amount: null, estimated: true },
      ],
    },
    {
      id: "H",
      sectionLabel: "H",
      title: "Other",
      tolerance: "none",
      lines: [
        { label: "Owner's Title Insurance (optional)", amount: null, estimated: true },
        { label: "HOA Transfer Fee", amount: null, estimated: true },
      ],
    },
  ];
}

// ── Threshold Indicator ───────────────────────────────────────────────────────

function ThresholdBar({
  label,
  amount,
  loanAmount,
  tolerance,
  warningPct,
}: {
  label: string;
  amount: number;
  loanAmount: number;
  tolerance: Tolerance;
  warningPct?: number;
}) {
  const pct = loanAmount > 0 ? (amount / loanAmount) * 100 : 0;
  const barFill = Math.min(pct / (warningPct ?? 5), 1) * 100;
  const isWarn = warningPct != null && pct >= warningPct * 0.85;

  return (
    <div className={`le-threshold-bar-row${isWarn ? " warn" : ""}`}>
      <div className="le-threshold-bar-meta">
        <span className="le-threshold-bar-label">{label}</span>
        <span className="le-threshold-bar-amount">
          {fmt(amount)}
          <span className="le-threshold-bar-pct">
            {pct.toFixed(2)}% of loan
          </span>
        </span>
      </div>
      <div className="le-threshold-bar-track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={warningPct ?? 5}>
        <div
          className={`le-threshold-bar-fill tol-${tolerance}`}
          style={{ width: `${barFill}%` }}
        />
        {warningPct != null && (
          <div className="le-threshold-bar-limit-line" style={{ left: "85%" }} title={`${warningPct}% limit`} />
        )}
      </div>
      {warningPct != null && (
        <div className="le-threshold-bar-limit-label">
          {isWarn
            ? `⚠ Approaching ${warningPct}% HOEPA threshold`
            : `Limit: ${warningPct}% (${fmt(loanAmount * warningPct / 100)})`}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return usd.format(n);
}

function ToleranceBadge({ t }: { t: Tolerance }) {
  if (t === "zero") return <span className="trid-badge trid-badge--zero">Zero Tolerance</span>;
  if (t === "ten_pct") return <span className="trid-badge trid-badge--ten">10% Tolerance</span>;
  return <span className="trid-badge trid-badge--none">No Tolerance</span>;
}

function sectionTotal(section: FeeSection): number {
  return section.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
}

// ── Main Component ────────────────────────────────────────────────────────────

type TermsEdit = {
  interest_rate: string;
  term_months: string;
  amortization_type: string;
  rate_type: string;
  interest_rate_locked: boolean;
  rate_lock_days: string;
};

function termsToEdit(t: LoanTermsOut | null): TermsEdit {
  return {
    interest_rate:       t?.interest_rate != null ? String((Number(t.interest_rate) * 100).toFixed(4)) : "",
    term_months:         t?.term_months != null ? String(t.term_months) : "360",
    amortization_type:   t?.amortization_type ?? "fixed",
    rate_type:           t?.rate_type ?? "fixed",
    interest_rate_locked: t?.interest_rate_locked ?? false,
    rate_lock_days:      t?.rate_lock_days != null ? String(t.rate_lock_days) : "",
  };
}

export function WorkspaceLoanEstimate({ loan }: Props) {
  const { token } = useAuth();
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [termsEdit, setTermsEdit] = useState<TermsEdit | null>(null);
  const [savedTerms, setSavedTerms] = useState<TermsEdit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    if (detail?.terms !== undefined) {
      const initial = termsToEdit(detail.terms);
      setTermsEdit(initial);
      setSavedTerms(initial);
    }
  }, [detail?.terms]);

  const isDirty = termsEdit !== null && savedTerms !== null &&
    JSON.stringify(termsEdit) !== JSON.stringify(savedTerms);

  async function handleSave() {
    if (!token || !termsEdit) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await apiRequest(`/loans/${loan.id}/terms`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          interest_rate: termsEdit.interest_rate ? Number(termsEdit.interest_rate) / 100 : null,
          term_months: termsEdit.term_months ? Number(termsEdit.term_months) : null,
          amortization_type: termsEdit.amortization_type || null,
          rate_type: termsEdit.rate_type || null,
          interest_rate_locked: termsEdit.interest_rate_locked,
          rate_lock_days: termsEdit.rate_lock_days ? Number(termsEdit.rate_lock_days) : null,
        }),
      });
      setSavedTerms(termsEdit);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <div className="le-loading"><LoadingSpinner /></div>;
  }

  if (error) {
    return (
      <div className="le-empty">
        <p className="le-empty-title">Could not load loan data</p>
        <p className="le-empty-body">{error}</p>
      </div>
    );
  }

  const fin = detail?.financials ?? null;
  const loanAmount = Number(fin?.loan_amount ?? loan.loanAmount ?? 0);
  const rate = termsEdit?.interest_rate ? Number(termsEdit.interest_rate) / 100 : 0;
  const termMonths = termsEdit?.term_months ? Number(termsEdit.term_months) : 360;
  const amortType = termsEdit?.amortization_type ?? null;
  const monthlyPI = loanAmount > 0 && rate > 0
    ? calcMonthlyPI(loanAmount, rate, termMonths, amortType)
    : null;

  const totalOfPayments = monthlyPI != null ? monthlyPI * termMonths : null;
  const financeCharge = totalOfPayments != null ? totalOfPayments - loanAmount : null;

  const sections = loanAmount > 0 ? buildFeeSections(loanAmount, rate) : [];

  const zeroBucket = sections.filter((s) => s.tolerance === "zero").reduce((sum, s) => sum + sectionTotal(s), 0);
  const tenBucket = sections.filter((s) => s.tolerance === "ten_pct").reduce((sum, s) => sum + sectionTotal(s), 0);
  const noneBucket = sections.filter((s) => s.tolerance === "none").reduce((sum, s) => sum + sectionTotal(s), 0);
  const totalClosing = zeroBucket + tenBucket + noneBucket;

  const hoepaPct = loanAmount > 0 ? (zeroBucket / loanAmount) * 100 : 0;
  const hoepaTriggered = hoepaPct >= 5;

  function setTerms(patch: Partial<TermsEdit>) {
    setTermsEdit((t) => t ? { ...t, ...patch } : t);
  }

  return (
    <div className="le-wrapper">
      <WorkspaceSaveBar
        title="Loan Estimate"
        subtitle={`TRID — Reg Z / 12 CFR Part 1026.37 · ${loan.loanNumber}`}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => termsEdit && savedTerms && setTermsEdit(savedTerms)}
      />

      <div className="le-est-notice" style={{ marginBottom: 0 }}>
        <span className="le-est-badge">EST</span>
        Fee amounts are estimated from loan data. Edit terms above and save to persist changes.
      </div>

      {/* ── Loan Terms Box — editable ── */}
      <section className="le-terms-box" aria-label="Loan Terms">
        <h3 className="le-section-heading">Loan Terms</h3>
        <div className="le-terms-grid">
          <div className="le-terms-cell le-terms-cell--wide">
            <span className="le-terms-label">Loan Amount</span>
            <span className="le-terms-value">{fmt(loanAmount || null)}</span>
            <span className="le-terms-sub">Edit via loan financials</span>
          </div>
          <div className="le-terms-cell">
            <label className="le-terms-label" htmlFor="le-rate">Interest Rate (%)</label>
            <input
              id="le-rate"
              type="number"
              step="0.001"
              className="le-terms-input"
              value={termsEdit?.interest_rate ?? ""}
              onChange={(e) => setTerms({ interest_rate: e.target.value })}
              placeholder="e.g. 7.500"
            />
          </div>
          <div className="le-terms-cell">
            <span className="le-terms-label">Monthly P&amp;I</span>
            <span className="le-terms-value">{fmt(monthlyPI)}</span>
            <span className="le-terms-sub">Calculated</span>
          </div>
          <div className="le-terms-cell">
            <label className="le-terms-label" htmlFor="le-term">Term (months)</label>
            <input
              id="le-term"
              type="number"
              className="le-terms-input"
              value={termsEdit?.term_months ?? ""}
              onChange={(e) => setTerms({ term_months: e.target.value })}
              placeholder="360"
            />
          </div>
          <div className="le-terms-cell">
            <label className="le-terms-label" htmlFor="le-amort">Amortization</label>
            <select
              id="le-amort"
              className="le-terms-input"
              value={termsEdit?.amortization_type ?? "fixed"}
              onChange={(e) => setTerms({ amortization_type: e.target.value })}
            >
              <option value="fixed">Fixed</option>
              <option value="arm">ARM</option>
              <option value="interest_only">Interest Only</option>
            </select>
          </div>
          <div className="le-terms-cell">
            <label className="le-terms-label" htmlFor="le-rate-type">Rate Type</label>
            <select
              id="le-rate-type"
              className="le-terms-input"
              value={termsEdit?.rate_type ?? "fixed"}
              onChange={(e) => setTerms({ rate_type: e.target.value })}
            >
              <option value="fixed">Fixed</option>
              <option value="arm">Adjustable (ARM)</option>
              <option value="interest_only">Interest Only</option>
            </select>
          </div>
          <div className="le-terms-cell">
            <span className="le-terms-label">Rate Lock</span>
            <label className="le-terms-lock-label">
              <input
                type="checkbox"
                checked={termsEdit?.interest_rate_locked ?? false}
                onChange={(e) => setTerms({ interest_rate_locked: e.target.checked })}
              />
              Locked
            </label>
            {termsEdit?.interest_rate_locked && (
              <input
                type="number"
                className="le-terms-input le-terms-input--sm"
                placeholder="Days"
                value={termsEdit.rate_lock_days}
                onChange={(e) => setTerms({ rate_lock_days: e.target.value })}
              />
            )}
          </div>
          <div className="le-terms-cell">
            <span className="le-terms-label">Prepayment Penalty</span>
            <span className="le-terms-value">No</span>
          </div>
        </div>
      </section>

      {/* ── Projected Payments ── */}
      {monthlyPI != null && (
        <section className="le-projected-payments" aria-label="Projected Payments">
          <h3 className="le-section-heading">Projected Payments</h3>
          <div className="le-projected-grid">
            <div className="le-projected-cell">
              <span className="le-terms-label">Principal &amp; Interest</span>
              <span className="le-terms-value">{fmt(monthlyPI)}</span>
            </div>
            <div className="le-projected-cell">
              <span className="le-terms-label">Estimated Escrow</span>
              <span className="le-terms-value le-terms-value--muted">—</span>
              <span className="le-terms-sub">To be calculated</span>
            </div>
            <div className="le-projected-cell">
              <span className="le-terms-label">Estimated Total Monthly</span>
              <span className="le-terms-value">{fmt(monthlyPI)}</span>
            </div>
          </div>
          <div className="le-disclosure-row">
            <div><span className="le-terms-label">Total of Payments</span><span className="le-terms-value">{fmt(totalOfPayments)}</span></div>
            <div><span className="le-terms-label">Finance Charge</span><span className="le-terms-value">{fmt(financeCharge)}</span></div>
            <div><span className="le-terms-label">Amount Financed</span><span className="le-terms-value">{fmt(loanAmount || null)}</span></div>
          </div>
        </section>
      )}

      {/* ── Closing Cost Sections ── */}
      {sections.length > 0 && (
        <section className="le-costs-section" aria-label="Closing Costs">
          <h3 className="le-section-heading">Closing Cost Details</h3>
          <p className="le-trid-legend">
            <span className="trid-badge trid-badge--zero">Zero Tolerance</span> Cannot increase from LE to Closing Disclosure.
            <span className="trid-badge trid-badge--ten" style={{ marginLeft: "1rem" }}>10% Tolerance</span> Aggregate increase limited to 10%.
            <span className="trid-badge trid-badge--none" style={{ marginLeft: "1rem" }}>No Tolerance</span> May change freely.
          </p>

          {sections.map((section) => {
            const total = sectionTotal(section);
            return (
              <div key={section.id} className="le-fee-section">
                <div className="le-fee-section-header">
                  <span className="le-fee-section-id">Section {section.sectionLabel}</span>
                  <span className="le-fee-section-title">{section.title}</span>
                  <ToleranceBadge t={section.tolerance} />
                  <span className="le-fee-section-total">{fmt(total)}</span>
                </div>
                <table className="le-fee-table">
                  <tbody>
                    {section.lines.map((line, i) => (
                      <tr key={i} className={line.amount == null ? "le-fee-row--empty" : ""}>
                        <td className="le-fee-name">
                          {line.label}
                          {line.estimated && <span className="le-est-inline">Est.</span>}
                        </td>
                        <td className="le-fee-amount">{fmt(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="le-fee-subtotal-row">
                      <td>Section {section.sectionLabel} Total</td>
                      <td>{fmt(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          <div className="le-total-row">
            <span>Total Closing Costs (J)</span>
            <span>{fmt(totalClosing)}</span>
          </div>
          {loanAmount > 0 && (
            <div className="le-total-pct">
              {((totalClosing / loanAmount) * 100).toFixed(2)}% of loan amount
            </div>
          )}
        </section>
      )}

      {/* ── TRID Threshold Summary ── */}
      {loanAmount > 0 && (
        <section className="le-threshold-summary" aria-label="TRID Tolerance Summary">
          <h3 className="le-section-heading">TRID Tolerance Summary</h3>
          <p className="le-threshold-desc">
            Each threshold bucket shows estimated fees as a percentage of the loan amount.
            Bars are scaled to the HOEPA 5% points-and-fees limit.
          </p>

          <div className="le-threshold-bars">
            <ThresholdBar
              label="Zero Tolerance Fees (Sections A + B)"
              amount={zeroBucket}
              loanAmount={loanAmount}
              tolerance="zero"
              warningPct={5}
            />
            <ThresholdBar
              label="10% Tolerance Fees (Sections C + E recording)"
              amount={tenBucket}
              loanAmount={loanAmount}
              tolerance="ten_pct"
            />
            <ThresholdBar
              label="No Tolerance Fees (Sections F + G + H)"
              amount={noneBucket}
              loanAmount={loanAmount}
              tolerance="none"
            />
            <ThresholdBar
              label="Total Estimated Closing Costs"
              amount={totalClosing}
              loanAmount={loanAmount}
              tolerance="none"
              warningPct={5}
            />
          </div>

          <div className={`le-hoepa-flag ${hoepaTriggered ? "le-hoepa-flag--triggered" : "le-hoepa-flag--ok"}`}>
            <span className="le-hoepa-icon">{hoepaTriggered ? "⚠" : "✓"}</span>
            <div>
              <strong>HOEPA Points &amp; Fees Test</strong>
              <p>
                Origination charges (Section A) are{" "}
                <strong>{hoepaPct.toFixed(2)}% of loan amount</strong>.{" "}
                {hoepaTriggered
                  ? "This meets or exceeds the 5% HOEPA High-Cost Mortgage threshold — additional disclosures and restrictions may apply."
                  : `Below the 5% threshold (${fmt(loanAmount * 0.05)} max). No High-Cost Mortgage trigger.`}
              </p>
            </div>
          </div>

          <div className="le-tolerance-rules">
            <h4 className="le-tolerance-rules-title">Tolerance Rule Reference</h4>
            <div className="le-tolerance-rule-grid">
              <div className="le-tolerance-rule-card le-tolerance-rule-card--zero">
                <span className="le-tolerance-rule-badge">Zero Tolerance</span>
                <p>Sections A &amp; B, transfer taxes. Any increase from LE to CD is a cure violation. Lender must refund the difference within 3 business days of consummation.</p>
              </div>
              <div className="le-tolerance-rule-card le-tolerance-rule-card--ten">
                <span className="le-tolerance-rule-badge">10% Tolerance</span>
                <p>Section C &amp; E (recording). If the aggregate of these fees increases by more than 10% from LE to CD, the lender must cure the excess at or before consummation.</p>
              </div>
              <div className="le-tolerance-rule-card le-tolerance-rule-card--none">
                <span className="le-tolerance-rule-badge">No Tolerance</span>
                <p>Prepaids (F), initial escrow (G), optional owner&apos;s title insurance (H). These amounts may increase without triggering a cure obligation.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {loanAmount === 0 && (
        <div className="le-empty">
          <p className="le-empty-title">No financial data available</p>
          <p className="le-empty-body">Loan financials have not been entered for this loan. Closing cost estimates require a loan amount.</p>
        </div>
      )}
    </div>
  );
}
