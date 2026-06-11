import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { AssetReserveAnalysis } from "@/components/loans/workspace/AssetReserveAnalysis";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { WorkspaceFieldContextMenu } from "@/components/loans/workspace/WorkspaceFieldContextMenu";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import type { FieldMeta } from "@/components/loans/workspace/WorkspaceFieldContextMenu";
import type { BorrowerOut } from "@/types/api";
import type { FinancialAnalysisSubsection } from "@/types/financialAnalysis";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const fmt    = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : "-");

type IncomeForm = {
  base_income:    string;
  bonus:          string;
  overtime:       string;
  commission:     string;
  gross_income:   string;
  adjustments:    string;
  qualifying_se:  string;
  rental_income:   string;
  pitia:           string;
  underwriter_notes: string;
};

const EMPTY_FORM: IncomeForm = {
  base_income: "", bonus: "", overtime: "", commission: "",
  gross_income: "", adjustments: "", qualifying_se: "",
  rental_income: "", pitia: "",
  underwriter_notes: "",
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2: "W-2 Employee", self_employed: "Self-Employed", bank_statement: "Bank Statement",
  "1099": "1099 Contractor", rental: "Rental (DSCR)", assets: "Asset Depletion",
  pension_retirement: "Pension / Retirement", foreign: "Foreign Income", other: "Other",
};

const FINANCIAL_SUBSECTIONS: {
  id: FinancialAnalysisSubsection;
  label: string;
  description: string;
}[] = [
  { id: "overview", label: "Overview", description: "Income, asset, reserve, and risk snapshot." },
  { id: "employment", label: "Employment Income", description: "W-2, bonus, overtime, and commission worksheet." },
  { id: "self_employment", label: "Self Employment", description: "Self-employed add-backs and qualifying income." },
  { id: "rental", label: "Rental Income", description: "DSCR and subject property rental income." },
  { id: "assets", label: "Asset & Reserve Analysis", description: "Cash to close, reserves, ATR, and depletion allocations." },
  { id: "other_income", label: "Other Income", description: "Other income categories and support notes." },
  { id: "summary", label: "Income Calculation Summary", description: "Final qualifying income outputs." },
  { id: "audit", label: "Audit Trail", description: "Calculation history and field changes." },
];

export function WorkspaceIncome({ loan }: Props) {
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [form, setForm]           = useState<IncomeForm>(EMPTY_FORM);
  const [saved, setSaved]         = useState<IncomeForm>(EMPTY_FORM);
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [activeTab, setActiveTab] = useState<FinancialAnalysisSubsection>("overview");

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

  const totalMonthly = borrowers.reduce((sum, b) =>
    sum + (b.income_amount != null ? Number(b.income_amount) : 0), 0);
  const totalAnnual = totalMonthly * 12;

  const worksheetRent  = Number(form.rental_income) || 0;
  const worksheetPitia = Number(form.pitia) || 0;
  const worksheetDscr  = worksheetPitia > 0 ? (worksheetRent / worksheetPitia).toFixed(2) : "-";

  const qualifyingSE = Number(form.qualifying_se) || (Number(form.gross_income) - Number(form.adjustments));

  const wageTotal = ["base_income", "bonus", "overtime", "commission"]
    .reduce((s, k) => s + (Number(form[k as keyof IncomeForm]) || 0), 0);

  return (
    <div className="income-wrapper">
      <WorkspaceSaveBar
        title="Financial Analysis"
        subtitle={`Underwriting financial command center - ${loan.loanNumber}`}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      <div className="income-summary-bar">
        <div className="income-kpi-grid">
          <FinancialKpi label="Monthly qualifying income" value={totalMonthly > 0 ? fmt.format(totalMonthly) : "-"} />
          <FinancialKpi label="Annual qualifying income" value={totalAnnual > 0 ? fmt.format(totalAnnual) : "-"} />
          <FinancialKpi label="DTI" value={fmtPct(fin?.debt_to_income)} />
          <FinancialKpi label="DSCR" value={fin?.dscr != null ? fin.dscr.toFixed(2) : "-"} />
          <FinancialKpi label="Verified assets" value="Pending" />
          <FinancialKpi label="Reserves" value={fin?.cash_reserves != null ? fmt.format(Number(fin.cash_reserves)) : "-"} />
          <FinancialKpi label="Cash to close" value="Pending" />
          <FinancialKpi label="Warnings" value={fin?.debt_to_income && fin.debt_to_income > 0.5 ? "Review needed" : "None"} />
        </div>
      </div>

      <div className="income-section">
        <div className="income-section-header">
          <div>
            <h3 className="income-section-title">Financial Analysis Subsections</h3>
            <p className="income-section-hint">
              Review income, reserves, asset depletion, ATR support, and the calculation trail in one workspace.
            </p>
          </div>
          <div className="income-tabs">
            {FINANCIAL_SUBSECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`income-tab${activeTab === section.id ? " income-tab--active" : ""}`}
                onClick={() => setActiveTab(section.id)}
                title={section.description}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="income-overview-grid">
            <div className="income-overview-card">
              <span className="income-overview-label">Income posture</span>
              <strong>{totalMonthly > 0 ? "Income documented" : "Income pending"}</strong>
              <p>Borrower income sources roll up here before final underwriting review.</p>
            </div>
            <div className="income-overview-card">
              <span className="income-overview-label">Risk watch</span>
              <strong>{fin?.debt_to_income && fin.debt_to_income > 0.5 ? "DTI review" : "No active alerts"}</strong>
              <p>Warnings remain informational until backend guideline rules are connected.</p>
            </div>
            <div className="income-overview-card">
              <span className="income-overview-label">Asset workflow</span>
              <strong>Allocation model ready</strong>
              <p>One asset account can support cash to close, depletion, ATR, and reserves.</p>
            </div>
          </div>
        )}

        {activeTab === "overview" && borrowers.length > 0 && (
          <IncomeSources borrowers={borrowers} />
        )}

        {activeTab === "employment" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Base Income (mo.)"  value={form.base_income}  onChange={(v) => patch("base_income",  v)} loanId={loan.id} meta={{ label: "Base Income", apiKey: "base_income", dbColumn: "base_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Monthly base wage income." }} />
              <WorksheetField label="Bonus (mo.)"        value={form.bonus}        onChange={(v) => patch("bonus",        v)} loanId={loan.id} meta={{ label: "Bonus", apiKey: "bonus_income", dbColumn: "bonus_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Monthly bonus income (typically 2yr avg / 24)." }} />
              <WorksheetField label="Overtime (mo.)"     value={form.overtime}     onChange={(v) => patch("overtime",     v)} loanId={loan.id} meta={{ label: "Overtime", apiKey: "overtime_income", dbColumn: "overtime_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Monthly overtime income (2yr avg / 24)." }} />
              <WorksheetField label="Commission (mo.)"   value={form.commission}   onChange={(v) => patch("commission",   v)} loanId={loan.id} meta={{ label: "Commission", apiKey: "commission_income", dbColumn: "commission_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Monthly commission income (2yr avg / 24)." }} />
            </div>
            {wageTotal > 0 && (
              <div className="income-worksheet-total">
                <span>Total Qualifying Income</span>
                <strong>{fmt.format(wageTotal)} / mo</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === "self_employment" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Gross Income (mo.)"       value={form.gross_income}  onChange={(v) => patch("gross_income",  v)} loanId={loan.id} meta={{ label: "Gross Income", apiKey: "gross_self_employment_income", dbColumn: "gross_self_employment_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false }} />
              <WorksheetField label="Adjustments / Add-backs"  value={form.adjustments}   onChange={(v) => patch("adjustments",   v)} loanId={loan.id} meta={{ label: "Adjustments / Add-backs", apiKey: "se_adjustments", dbColumn: "se_adjustments", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Business expenses added back to qualifying income." }} />
              <WorksheetField label="Qualifying Income (mo.)"  value={form.qualifying_se} onChange={(v) => patch("qualifying_se", v)} hint="Override auto-calculation" loanId={loan.id} meta={{ label: "Qualifying SE Income", apiKey: "qualifying_se_income", dbColumn: "qualifying_se_income", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Override auto-calculated self-employment qualifying income." }} />
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
          <AssetReserveAnalysis loanId={loan.id} />
        )}

        {activeTab === "rental" && (
          <div className="income-worksheet">
            <div className="income-worksheet-grid">
              <WorksheetField label="Gross Rental Income (mo.)" value={form.rental_income} onChange={(v) => patch("rental_income", v)} loanId={loan.id} meta={{ label: "Monthly Rent", apiKey: "monthly_rent", dbColumn: "monthly_rent", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Gross monthly rental income from subject property." }} />
              <WorksheetField label="PITIA (mo.)"               value={form.pitia}         onChange={(v) => patch("pitia",         v)} hint="Principal + Interest + Tax + Insurance + HOA" loanId={loan.id} meta={{ label: "PITIA", apiKey: "pitia", dbColumn: "pitia", table: "loan_financials", fieldType: "numeric(14,2)", required: false, description: "Monthly PITIA used as the DSCR denominator." }} />
            </div>
            {worksheetRent > 0 && worksheetPitia > 0 && (
              <div className="income-worksheet-total">
                <span>DSCR Ratio</span>
                <strong className={Number(worksheetDscr) < 1 ? "income-dscr--low" : ""}>{worksheetDscr}</strong>
              </div>
            )}
          </div>
        )}

        {activeTab === "other_income" && (
          <FinancialPlaceholder
            title="Other Income"
            body="Use this area for pension, social security, alimony, note income, foreign income, and other supported qualifying income categories."
          />
        )}

        {activeTab === "summary" && (
          <div className="income-summary-output">
            <div>
              <span>Borrower income total</span>
              <strong>{totalMonthly > 0 ? fmt.format(totalMonthly) : "-"}</strong>
            </div>
            <div>
              <span>Employment worksheet total</span>
              <strong>{wageTotal > 0 ? fmt.format(wageTotal) : "-"}</strong>
            </div>
            <div>
              <span>Self-employed worksheet total</span>
              <strong>{qualifyingSE > 0 ? fmt.format(qualifyingSE) : "-"}</strong>
            </div>
            <div>
              <span>Rental DSCR</span>
              <strong>{worksheetDscr}</strong>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <FinancialPlaceholder
            title="Calculation Audit Trail"
            body="Future calculation runs will preserve input snapshots, outputs, rule versions, user, and timestamp for underwriting defensibility."
          />
        )}
      </div>

      {/* Underwriter Notes */}
      <div className="income-section">
        <h3 className="income-section-title">Underwriter Notes</h3>
        <p className="income-section-hint">Document income rationale, adjustments, compensating factors, and exceptions.</p>
        <WorkspaceFieldContextMenu
          loanId={loan.id}
          meta={{ label: "Income UW Notes", apiKey: "income_uw_notes", dbColumn: "income_uw_notes", table: "loans", fieldType: "text", required: false, description: "Income analysis narrative, compensating factors, and adjustments." }}
        >
          <div>
            <textarea
              className="income-textarea"
              rows={6}
              placeholder="Enter income analysis notes, compensating factors, and any adjustments made to qualifying income..."
              value={form.underwriter_notes}
              onChange={(e) => patch("underwriter_notes", e.target.value)}
            />
          </div>
        </WorkspaceFieldContextMenu>
      </div>

    </div>
  );
}

function FinancialKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="income-kpi">
      <span className="income-kpi-label">{label}</span>
      <span className="income-kpi-value">{value}</span>
    </div>
  );
}

function IncomeSources({ borrowers }: { borrowers: BorrowerOut[] }) {
  return (
    <div className="income-sources-grid">
      {borrowers.map((borrower) => {
        const name = [borrower.first_name, borrower.last_name].filter(Boolean).join(" ") || "Borrower";
        return (
          <div key={borrower.id} className="income-source-card">
            <div className="income-source-header">
              <span className="income-source-name">{name}</span>
              <span className="income-source-type">
                {borrower.income_type
                  ? (INCOME_TYPE_LABELS[borrower.income_type] ?? borrower.income_type)
                  : "-"}
              </span>
            </div>
            <div className="income-source-amount">
              {borrower.income_amount != null
                ? (
                    <>
                      <strong>{fmt.format(Number(borrower.income_amount))}</strong>
                      <span>/mo</span>
                    </>
                  )
                : <span className="income-source-empty">No income on file</span>}
            </div>
            {borrower.employer_name && <p className="income-source-detail">{borrower.employer_name}</p>}
            {borrower.employment_status && <p className="income-source-detail">{borrower.employment_status}</p>}
          </div>
        );
      })}
    </div>
  );
}

function FinancialPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="income-financial-placeholder">
      <span>Planned workspace</span>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}

function WorksheetField({ label, value, onChange, hint, loanId, meta }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  loanId?: string;
  meta?: FieldMeta;
}) {
  const field = (
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

  if (loanId && meta) {
    return (
      <WorkspaceFieldContextMenu loanId={loanId} meta={meta}>
        {field}
      </WorkspaceFieldContextMenu>
    );
  }
  return field;
}
