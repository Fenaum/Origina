import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import { useLoanDetail } from "@/hooks/useLoanDetail";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { BorrowerOut } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2:               "W-2 Employee",
  self_employed:    "Self-Employed",
  bank_statement:   "Bank Statement",
  "1099":           "1099 Contractor",
  rental:           "Rental Income (DSCR)",
  assets:           "Asset Depletion",
  pension_retirement: "Pension / Retirement",
  foreign:          "Foreign Income",
  other:            "Other",
};

const BORROWER_TYPE_LABELS: Record<string, string> = {
  primary_borrower: "Primary Borrower",
  co_borrower:      "Co-Borrower",
  guarantor:        "Guarantor",
  other:            "Other",
};

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="urla-field">
      <span className="urla-field-label">{label}</span>
      <span className="urla-field-value">{value ?? "—"}</span>
    </div>
  );
}

type BorrowerEdit = Partial<Pick<BorrowerOut,
  "first_name" | "last_name" | "email" | "phone" | "dob" | "marital_status" |
  "dependents" | "employment_status" | "employer_name" | "job_title" |
  "years_on_job" | "income_type" | "income_amount"
>>;

export function WorkspaceBorrowerURLA({ loan }: Props) {
  const { token } = useAuth();
  const { detail, loading, error } = useLoanDetail(loan.id);
  const [edits, setEdits] = useState<Record<string, BorrowerEdit>>({});
  const [saved, setSaved] = useState<Record<string, BorrowerEdit>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    if (detail?.borrowers) {
      const initial = Object.fromEntries(detail.borrowers.map((b) => [b.id, {} as BorrowerEdit]));
      setEdits(initial);
      setSaved(initial);
    }
  }, [detail?.borrowers]);

  const isDirty = JSON.stringify(edits) !== JSON.stringify(saved);

  async function handleSave() {
    if (!token || !detail?.borrowers) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        detail.borrowers.map((b) => {
          const patch = edits[b.id];
          if (!patch || Object.keys(patch).length === 0) return Promise.resolve();
          return apiRequest(`/borrowers/${b.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify(patch),
          });
        }),
      );
      setSaved(edits);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function patchBorrower(borrowerId: string, patch: BorrowerEdit) {
    setEdits((prev) => ({ ...prev, [borrowerId]: { ...prev[borrowerId], ...patch } }));
  }

  if (loading) {
    return (
      <div className="urla-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="urla-empty">
        <p className="urla-empty-title">Could not load borrower data</p>
        <p className="urla-empty-body">{error}</p>
      </div>
    );
  }

  const borrowers = detail?.borrowers ?? [];

  if (borrowers.length === 0) {
    return (
      <div className="urla-empty">
        <p className="urla-empty-title">No borrowers on file</p>
        <p className="urla-empty-body">Borrower records have not been created for this loan yet.</p>
      </div>
    );
  }

  const primary = borrowers.find((b) => b.type === "primary_borrower") ?? borrowers[0]!;
  const others = borrowers.filter((b) => b.id !== primary.id);

  function EditableBorrowerCard({ borrower }: { borrower: BorrowerOut }) {
    const patch = edits[borrower.id] ?? {};
    const merged = { ...borrower, ...patch };
    const typeLabel = BORROWER_TYPE_LABELS[borrower.type] ?? borrower.type;

    function field(k: keyof BorrowerEdit) {
      return {
        value: (merged[k] as string | number | null | undefined) ?? "",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
          patchBorrower(borrower.id, { [k]: e.target.value || null }),
      };
    }

    return (
      <div className="urla-borrower-card">
        <div className="urla-borrower-header">
          <h3 className="urla-borrower-name">
            {[merged.first_name, merged.last_name].filter(Boolean).join(" ") || "—"}
          </h3>
          <span className="urla-borrower-badge">{typeLabel}</span>
        </div>

        <div className="urla-section">
          <p className="urla-section-title">Section 1a — Personal Information</p>
          <div className="urla-field-grid">
            <div className="urla-field">
              <label className="urla-field-label">First Name</label>
              <input className="urla-field-input" {...field("first_name")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Last Name</label>
              <input className="urla-field-input" {...field("last_name")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Date of Birth</label>
              <input type="date" className="urla-field-input" {...field("dob")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">SSN (Last 4)</label>
              <span className="urla-field-value">{borrower.ssn_last4 ? `···-··-${borrower.ssn_last4}` : "—"}</span>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Marital Status</label>
              <select className="urla-field-input" {...field("marital_status")}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="separated">Separated</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Dependents</label>
              <input type="number" className="urla-field-input" value={(merged.dependents ?? "")} onChange={(e) => patchBorrower(borrower.id, { dependents: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Email</label>
              <input type="email" className="urla-field-input" {...field("email")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Phone</label>
              <input type="tel" className="urla-field-input" {...field("phone")} />
            </div>
          </div>
        </div>

        <div className="urla-section">
          <p className="urla-section-title">Section 1b — Employment</p>
          <div className="urla-field-grid">
            <div className="urla-field">
              <label className="urla-field-label">Employment Status</label>
              <select className="urla-field-input" {...field("employment_status")}>
                <option value="">—</option>
                <option value="employed">Employed</option>
                <option value="self_employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="investor">Investor</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Employer</label>
              <input className="urla-field-input" {...field("employer_name")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Job Title</label>
              <input className="urla-field-input" {...field("job_title")} />
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Years on Job</label>
              <input type="number" className="urla-field-input" value={(merged.years_on_job ?? "")} onChange={(e) => patchBorrower(borrower.id, { years_on_job: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
        </div>

        <div className="urla-section">
          <p className="urla-section-title">Section 1c — Income</p>
          <div className="urla-field-grid">
            <div className="urla-field">
              <label className="urla-field-label">Income Type</label>
              <select className="urla-field-input" {...field("income_type")}>
                <option value="">—</option>
                {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="urla-field">
              <label className="urla-field-label">Monthly Income ($)</label>
              <input type="number" className="urla-field-input" value={(merged.income_amount ?? "")} onChange={(e) => patchBorrower(borrower.id, { income_amount: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
        </div>

        <div className="urla-section">
          <p className="urla-section-title">Section 8 — Government Monitoring (HMDA)</p>
          <p className="urla-hmda-notice">
            This information is collected for federal monitoring purposes only. It does not affect the credit decision.
          </p>
          <div className="urla-field-grid">
            <Field label="Ethnicity" value={borrower.ethnicity} />
            <Field label="Race" value={borrower.race} />
            <Field label="Sex" value={borrower.gender} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="urla-wrapper">
      <WorkspaceSaveBar
        title="Borrower URLA"
        subtitle={`Fannie Mae Form 1003 · ${loan.loanNumber}`}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setSaved(edits)}
      />

      <div className="urla-property-section">
        <p className="urla-section-title">Property and Loan Information</p>
        <div className="urla-field-grid">
          <Field label="Loan Amount" value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(loan.loanAmount)} />
          <Field label="Loan Program" value={loan.loanProgram} />
          <Field label="Property State" value={loan.propertyState} />
          <Field label="Loan Status" value={loan.status} />
        </div>
      </div>

      <EditableBorrowerCard borrower={primary} />
      {others.map((b) => (
        <EditableBorrowerCard key={b.id} borrower={b} />
      ))}
    </div>
  );
}
