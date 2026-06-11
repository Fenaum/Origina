import { useState } from "react";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { WorkspaceFieldContextMenu } from "@/components/loans/workspace/WorkspaceFieldContextMenu";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type UwDecision = "pending" | "approved_conditional" | "approved" | "suspended" | "denied";

type UwForm = {
  decision: UwDecision;
  decisionDate: string;
  ltv_override: string;
  dti_override: string;
  riskNotes: string;
  uwNotes: string;
  creditScore: string;
};

const DECISION_LABELS: Record<UwDecision, string> = {
  pending:              "Pending Review",
  approved_conditional: "Approved — Conditional",
  approved:             "Approved — Clear",
  suspended:            "Suspended",
  denied:               "Denied",
};

const EMPTY: UwForm = {
  decision: "pending",
  decisionDate: "",
  ltv_override: "",
  dti_override: "",
  riskNotes: "",
  uwNotes: "",
  creditScore: "",
};

export function WorkspaceUnderwriting({ loan }: Props) {
  const [form, setForm] = useState<UwForm>(EMPTY);
  const [saved, setSaved] = useState<UwForm>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(patch: Partial<UwForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await new Promise<void>((r) => setTimeout(r, 600));
      setSaved(form);
      setSaveCount((c) => c + 1);
    } catch {
      setSaveError("Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="uw-wrapper">
      <WorkspaceSaveBar
        title="Underwriting"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      <div className="uw-content">
        {/* Decision */}
        <section className="uw-section">
          <h3 className="uw-section-title">Credit Decision</h3>
          <div className="uw-field-grid">
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "Decision", apiKey: "uw_decision", dbColumn: "uw_decision", table: "loans", fieldType: "enum", required: false }}
            >
              <div className="uw-field">
                <label className="uw-label">Decision</label>
                <select
                  className="uw-select"
                  value={form.decision}
                  onChange={(e) => set({ decision: e.target.value as UwDecision })}
                >
                  {(Object.keys(DECISION_LABELS) as UwDecision[]).map((k) => (
                    <option key={k} value={k}>{DECISION_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </WorkspaceFieldContextMenu>
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "Decision Date", apiKey: "uw_decision_date", dbColumn: "uw_decision_date", table: "loans", fieldType: "date", required: false }}
            >
              <div className="uw-field">
                <label className="uw-label">Decision Date</label>
                <input
                  type="date"
                  className="uw-input"
                  value={form.decisionDate}
                  onChange={(e) => set({ decisionDate: e.target.value })}
                />
              </div>
            </WorkspaceFieldContextMenu>
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "Credit Score", apiKey: "fico_score", dbColumn: "fico_score", table: "loan_financials", fieldType: "integer", required: false, description: "Representative FICO score used for underwriting." }}
            >
              <div className="uw-field">
                <label className="uw-label">Credit Score</label>
                <input
                  type="number"
                  className="uw-input"
                  placeholder="e.g. 720"
                  value={form.creditScore}
                  onChange={(e) => set({ creditScore: e.target.value })}
                />
              </div>
            </WorkspaceFieldContextMenu>
          </div>
        </section>

        {/* Risk Metrics */}
        <section className="uw-section">
          <h3 className="uw-section-title">Risk Analysis</h3>
          <div className="uw-field-grid">
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "LTV Override", apiKey: "ltv", dbColumn: "ltv", table: "loan_financials", fieldType: "numeric(5,4)", required: false, description: "Loan-to-value ratio. Stored as decimal (e.g. 0.80 = 80%)." }}
            >
              <div className="uw-field">
                <label className="uw-label">LTV Override (%)</label>
                <input
                  type="number"
                  className="uw-input"
                  placeholder="e.g. 80.00"
                  value={form.ltv_override}
                  onChange={(e) => set({ ltv_override: e.target.value })}
                />
                <span className="uw-hint">Leave blank to use calculated LTV</span>
              </div>
            </WorkspaceFieldContextMenu>
            <WorkspaceFieldContextMenu
              loanId={loan.id}
              meta={{ label: "DTI Override", apiKey: "debt_to_income", dbColumn: "debt_to_income", table: "loan_financials", fieldType: "numeric(5,4)", required: false, description: "Debt-to-income ratio. Stored as decimal (e.g. 0.43 = 43%)." }}
            >
              <div className="uw-field">
                <label className="uw-label">DTI Override (%)</label>
                <input
                  type="number"
                  className="uw-input"
                  placeholder="e.g. 43.00"
                  value={form.dti_override}
                  onChange={(e) => set({ dti_override: e.target.value })}
                />
                <span className="uw-hint">Leave blank to use calculated DTI</span>
              </div>
            </WorkspaceFieldContextMenu>
          </div>
          <WorkspaceFieldContextMenu
            loanId={loan.id}
            meta={{ label: "Risk Notes", apiKey: "risk_notes", dbColumn: "risk_notes", table: "loans", fieldType: "text", required: false, description: "Notable risk factors, mitigants, or guideline deviations." }}
          >
            <div className="uw-field uw-field--full">
              <label className="uw-label">Risk Notes</label>
              <textarea
                className="uw-textarea"
                rows={3}
                placeholder="Notable risk factors, mitigants, or guideline deviations…"
                value={form.riskNotes}
                onChange={(e) => set({ riskNotes: e.target.value })}
              />
            </div>
          </WorkspaceFieldContextMenu>
        </section>

        {/* UW Notes */}
        <section className="uw-section">
          <h3 className="uw-section-title">Underwriter Notes</h3>
          <WorkspaceFieldContextMenu
            loanId={loan.id}
            meta={{ label: "UW Notes", apiKey: "uw_notes", dbColumn: "uw_notes", table: "loans", fieldType: "text", required: false, description: "Full underwriting narrative, income analysis, asset review." }}
          >
            <div className="uw-field uw-field--full">
              <label className="uw-label">Internal Notes</label>
              <textarea
                className="uw-textarea"
                rows={5}
                placeholder="Full underwriting narrative, income analysis, asset review…"
                value={form.uwNotes}
                onChange={(e) => set({ uwNotes: e.target.value })}
              />
            </div>
          </WorkspaceFieldContextMenu>
        </section>

        {/* Exceptions placeholder */}
        <section className="uw-section">
          <h3 className="uw-section-title">Exceptions</h3>
          <div className="uw-placeholder-notice">
            Exception tracking will be built in the next milestone. Exceptions are stored in the <code>loan_exceptions</code> table.
          </div>
        </section>
      </div>
    </div>
  );
}
