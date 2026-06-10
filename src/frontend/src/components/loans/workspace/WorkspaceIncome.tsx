import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const fmt    = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

type IncomeForm = {
  // Wage earner
  base_income:    string;
  bonus:          string;
  overtime:       string;
  commission:     string;
  // Self-employed
  gross_income:   string;
  adjustments:    string;
  qualifying_se:  string;
  // Asset depletion
  eligible_assets: string;
  depletion_term:  string;
  // DSCR
  rental_income:   string;
  pitia:           string;
  // Notes
  underwriter_notes: string;
};

const EMPTY_FORM: IncomeForm = {
  base_income: "", bonus: "", overtime: "", commission: "",
  gross_income: "", adjustments: "", qualifying_se: "",
  eligible_assets: "", depletion_term: "",
  rental_income: "", pitia: "",
  underwriter_notes: "",
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2: "W-2 Employee", self_employed: "Self-Employed", bank_statement: "Bank Statement",
  "1099": "1099 Contractor", rental: "Rental (DSCR)", assets: "Asset Depletion",
  pension_retirement: "Pension / Retirement", foreign: "Foreign Income", other: "Other",
};

export function WorkspaceIncome({ loan }: Props) {
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [form, setForm]           = useState<IncomeForm>(EMPTY_FORM);
  const [saved, setSaved]         = useState<IncomeForm>(EMPTY_FORM);
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"wage" | "self" | "assets" | "dscr">("wage");

  useEffect(() => {
    if (!detail?.financials) return;
    const fin = detail.financials;
    const init: IncomeForm = {
      ...EMPTY_FORM,
      rental_income: fin.monthly_rent != null ? String(fin.monthly_rent) : "",
    };
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) { setForm(init); setSaved(init); }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.financials?.loan_id]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function patch(k: keyof IncomeForm, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    await new Promise((res) => setTimeout(res, 600));
    setSaved(form);
    setSaveCount((c) => c + 1);
    setIsSaving(false);
  }

  if (loading) return <div className="urla-loading"><LoadingSpinner /></div>;
  if (error)   return <div className="urla-empty"><p className="urla-empty-title">Could not load income data</p><p className="urla-empty-body">{error}</p></div>;

  const fin       = detail?.financials;
  const borrowers = detail?.borrowers ?? [];

  // Aggregate qualifying income from all borrowers
  const totalMonthly = borrowers.reduce((sum, b) =>
    sum + (b.income_amount != null ? Number(b.income_amount) : 0), 0);
  const totalAnnual = totalMonthly * 12;

  // Calculated DSCR from worksheet fields
  const worksheetRent  = Number(form.rental_income) || 0;
  const worksheetPitia = Number(form.pitia) || 0;
  const worksheetDscr  = worksheetPitia > 0 ? (worksheetRent / worksheetPitia).toFixed(2) : "—";

  // Calculated asset depletion monthly
  const eligibleAssets   = Number(form.eligible_assets) || 0;
  const depletionMonths  = Number(form.depletion_term)  || 0;
  const assetMonthly     = depletionMonths > 0 ? fmt.format(eligibleAssets / depletionMonths) : "—";

  // Self-employed qualifying income
  const qualifyingSE = Number(form.qualifying_se) || (Number(form.gross_income) - Number(form.adjustments));

  // W-2 total
  const wageTotal = ["base_income", "bonus", "overtime", "commission"]
    .reduce((s, k) => s + (Number(form[k as keyof IncomeForm]) || 0), 0);

  return (
    <div className="income-wrapper">
      <WorkspaceSaveBar
        title="Income Analysis"
        subtitle={`Qualifying Income Worksheet · ${loan.loanNumber}`}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      {/* Summary bar */}
      <div className="income-summary-bar">
        <div className="income-kpi-grid">
          <div className="income-kpi">
            <span className="income-kpi-label">Total Monthly Income</span>
            <span className="income-kpi-value">{totalMonthly > 0 ? fmt.format(totalMonthly) : "—"}</span>
          </div>
          <div className="income-kpi">
            <span className="income-kpi-label">Total Annual Income</span>
            <span className="income-kpi-value">{totalAnnual > 0 ? fmt.format(totalAnnual) : "—"}</span>
          </div>
          <div className="income-kpi">
            <span className="income-kpi-label">DTI</span>
            <span className="income-kpi-value">{fmtPct(fin?.debt_to_income)}</span>
          </div>
          <div className="income-kpi">
            <span className="income-kpi-label">DSCR (File)</span>
            <span className="income-kpi-value">{fin?.dscr != null ? fin.dscr.toFixed(2) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Income Sources */}
      {borrowers.length > 0 && (
        <div className="income-section">
          <h3 className="income-section-title">Income Sources</h3>
          <div className="income-sources-grid">
            {borrowers.map((b) => {
              const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "Borrower";
              return (
                <div key={b.id} className="income-source-card">
                  <div className="income-source-header">
                    <span className="income-source-name">{name}</span>
                    <span className="income-source-type">
                      {b.income_type ? (INCOME_TYPE_LABELS[b.income_type] ?? b.income_type) : "—"}
                    </span>
                  </div>
                  <div className="income-source-amount">
                    {b.income_amount != null
                      ? <><strong>{fmt.format(Number(b.income_amount))}</strong><span>/mo</span></>
                      : <span className="income-source-empty">No income on file</span>}
                  </div>
                  {b.employer_name && <p className="income-source-detail">{b.employer_name}</p>}
                  {b.employment_status && <p className="income-source-detail">{b.employment_status}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calculation Worksheet */}
      <div className="income-section">
        <div className="income-section-header">
          <h3 className="income-section-title">Income Calculation Worksheet</h3>
          <div className="income-tabs">
            {(["wage", "self", "assets", "dscr"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`income-tab${activeTab === t ? " income-tab--active" : ""}`}
                onClick={() => setActiveTab(t)}
              >
                {{ wage: "W-2 / Wage", self: "Self-Employed", assets: "Asset Depletion", dscr: "DSCR" }[t]}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "wage" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Base Income (mo.)"  value={form.base_income}  onChange={(v) => patch("base_income",  v)} />
              <WorksheetField label="Bonus (mo.)"        value={form.bonus}        onChange={(v) => patch("bonus",        v)} />
              <WorksheetField label="Overtime (mo.)"     value={form.overtime}     onChange={(v) => patch("overtime",     v)} />
              <WorksheetField label="Commission (mo.)"   value={form.commission}   onChange={(v) => patch("commission",   v)} />
            </div>
            {wageTotal > 0 && (
              <div className="income-worksheet-total">
                <span>Total Qualifying Income</span>
                <strong>{fmt.format(wageTotal)} / mo</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === "self" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Gross Income (mo.)"       value={form.gross_income}  onChange={(v) => patch("gross_income",  v)} />
              <WorksheetField label="Adjustments / Add-backs"  value={form.adjustments}   onChange={(v) => patch("adjustments",   v)} />
              <WorksheetField label="Qualifying Income (mo.)"  value={form.qualifying_se} onChange={(v) => patch("qualifying_se", v)} hint="Override auto-calculation" />
            </div>
            {qualifyingSE > 0 && (
              <div className="income-worksheet-total">
                <span>Qualifying Income</span>
                <strong>{fmt.format(qualifyingSE)} / mo</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === "assets" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Eligible Assets ($)"    value={form.eligible_assets} onChange={(v) => patch("eligible_assets", v)} />
              <WorksheetField label="Depletion Term (mo.)"   value={form.depletion_term}  onChange={(v) => patch("depletion_term",  v)} hint="Typically 360 for 30-yr" />
            </div>
            {eligibleAssets > 0 && depletionMonths > 0 && (
              <div className="income-worksheet-total">
                <span>Monthly Asset Income</span>
                <strong>{assetMonthly} / mo</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === "dscr" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Gross Rental Income (mo.)" value={form.rental_income} onChange={(v) => patch("rental_income", v)} />
              <WorksheetField label="PITIA (mo.)"               value={form.pitia}         onChange={(v) => patch("pitia",         v)} hint="Principal + Interest + Tax + Insurance + HOA" />
            </div>
            {worksheetRent > 0 && worksheetPitia > 0 && (
              <div className="income-worksheet-total">
                <span>DSCR Ratio</span>
                <strong className={Number(worksheetDscr) < 1 ? "income-dscr--low" : ""}>{worksheetDscr}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Underwriter Notes */}
      <div className="income-section">
        <h3 className="income-section-title">Underwriter Notes</h3>
        <p className="income-section-hint">Document income rationale, adjustments, compensating factors, and exceptions.</p>
        <textarea
          className="income-textarea"
          rows={6}
          placeholder="Enter income analysis notes, compensating factors, and any adjustments made to qualifying income…"
          value={form.underwriter_notes}
          onChange={(e) => patch("underwriter_notes", e.target.value)}
        />
      </div>

    </div>
  );
}

function WorksheetField({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="income-field">
      <label className="income-field-label">{label}</label>
      <input
        type="number"
        className="income-field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        min="0"
      />
      {hint && <span className="income-field-hint">{hint}</span>}
    </div>
  );
}
