import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import type { LoanSummary } from "@/types/loan";
import type { AppraisalOrderOut } from "@/types/api";

type Props = { loan: LoanSummary };

type AppraisalForm = {
  ordered_date: string;
  vendor_name: string;
  appraiser_name: string;
  external_ref: string;
  due_date: string;
  inspection_date: string;
  received_date: string;
  appraised_value: string;
  purchase_price: string;
  appraisal_type: string;
  property_condition: string;
  review_status: string;
  reviewed_by: string;
  review_date: string;
  has_rov: boolean;
  second_appraisal: boolean;
  review_notes: string;
};

const EMPTY: AppraisalForm = {
  ordered_date: "", vendor_name: "", appraiser_name: "", external_ref: "",
  due_date: "", inspection_date: "", received_date: "", appraised_value: "",
  purchase_price: "", appraisal_type: "", property_condition: "",
  review_status: "", reviewed_by: "", review_date: "",
  has_rov: false, second_appraisal: false, review_notes: "",
};

function toForm(a: AppraisalOrderOut): AppraisalForm {
  return {
    ordered_date: a.ordered_date ?? "",
    vendor_name: a.vendor_name ?? "",
    appraiser_name: a.appraiser_name ?? "",
    external_ref: a.external_ref ?? "",
    due_date: a.due_date ?? "",
    inspection_date: a.inspection_date ?? "",
    received_date: a.received_date ?? "",
    appraised_value: a.appraised_value != null ? String(a.appraised_value) : "",
    purchase_price: a.purchase_price != null ? String(a.purchase_price) : "",
    appraisal_type: a.appraisal_type ?? "",
    property_condition: a.property_condition ?? "",
    review_status: a.review_status ?? "",
    reviewed_by: a.reviewed_by ?? "",
    review_date: a.review_date ?? "",
    has_rov: a.has_rov ?? false,
    second_appraisal: a.second_appraisal ?? false,
    review_notes: a.review_notes ?? "",
  };
}

const STEPS = [
  { key: "ordered_date",    label: "Ordered" },
  { key: "inspection_date", label: "Inspection" },
  { key: "received_date",   label: "Received" },
  { key: "review_date",     label: "Reviewed" },
];

export function WorkspaceAppraisal({ loan }: Props) {
  const { token } = useAuth();
  const [appraisalId, setAppraisalId] = useState<string | null>(null);
  const [form, setForm] = useState<AppraisalForm>(EMPTY);
  const [saved, setSaved] = useState<AppraisalForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<AppraisalOrderOut[]>(`/appraisals/?loan_id=${loan.id}`, { token })
      .then((list) => {
        if (cancelled) return;
        const primary = list.find((a) => a.is_primary) ?? list[0] ?? null;
        if (primary) {
          setAppraisalId(primary.id);
          const f = toForm(primary);
          setForm(f);
          setSaved(f);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(patch: Partial<AppraisalForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleCreate() {
    if (!token) return;
    setCreatingNew(true);
    try {
      const created = await apiRequest<AppraisalOrderOut>(`/appraisals/`, {
        token, method: "POST",
        body: JSON.stringify({ loan_id: loan.id, is_primary: true }),
      });
      setAppraisalId(created.id);
      const f = toForm(created);
      setForm(f);
      setSaved(f);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not create appraisal order");
    } finally {
      setCreatingNew(false);
    }
  }

  async function handleSave() {
    if (!token || !appraisalId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        ordered_date: form.ordered_date || null,
        vendor_name: form.vendor_name || null,
        appraiser_name: form.appraiser_name || null,
        external_ref: form.external_ref || null,
        due_date: form.due_date || null,
        inspection_date: form.inspection_date || null,
        received_date: form.received_date || null,
        appraised_value: form.appraised_value ? Number(form.appraised_value) : null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        appraisal_type: form.appraisal_type || null,
        property_condition: form.property_condition || null,
        review_status: form.review_status || null,
        reviewed_by: form.reviewed_by || null,
        review_date: form.review_date || null,
        has_rov: form.has_rov,
        second_appraisal: form.second_appraisal,
        review_notes: form.review_notes || null,
      };
      await apiRequest(`/appraisals/${appraisalId}`, { token, method: "PATCH", body: JSON.stringify(payload) });
      setSaved(form);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  const activeStep = STEPS.findLastIndex((s) => !!form[s.key as keyof AppraisalForm]);

  return (
    <div className="appr-wrapper">
      <WorkspaceSaveBar
        title="Appraisal"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      {loading ? (
        <div className="appr-loading">Loading appraisal…</div>
      ) : !appraisalId ? (
        <div className="appr-empty">
          <p>No appraisal order on file for this loan.</p>
          <button
            type="button"
            className="appr-create-btn"
            onClick={handleCreate}
            disabled={creatingNew}
          >
            {creatingNew ? "Creating…" : "Create Appraisal Order"}
          </button>
          {saveError && <div className="appr-error">{saveError}</div>}
        </div>
      ) : (
        <div className="appr-content">
          {/* Progress stepper */}
          <section className="appr-section">
            <h3 className="appr-section-title">Order Progress</h3>
            <div className="appr-stepper">
              {STEPS.map((step, i) => (
                <div
                  key={step.key}
                  className={`appr-step${i <= activeStep ? " appr-step--done" : ""}${i === activeStep + 1 ? " appr-step--next" : ""}`}
                >
                  <div className="appr-step-dot">{i <= activeStep ? "✓" : i + 1}</div>
                  <span className="appr-step-label">{step.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Order details */}
          <section className="appr-section">
            <h3 className="appr-section-title">Order Details</h3>
            <div className="appr-field-grid">
              <FieldInput label="Ordered Date" value={form.ordered_date} onChange={(v) => set({ ordered_date: v })} type="date" />
              <FieldInput label="Due Date" value={form.due_date} onChange={(v) => set({ due_date: v })} type="date" />
              <FieldInput label="Inspection Date" value={form.inspection_date} onChange={(v) => set({ inspection_date: v })} type="date" />
              <FieldInput label="Received Date" value={form.received_date} onChange={(v) => set({ received_date: v })} type="date" />
              <FieldInput label="Vendor / AMC" value={form.vendor_name} onChange={(v) => set({ vendor_name: v })} />
              <FieldInput label="Appraiser Name" value={form.appraiser_name} onChange={(v) => set({ appraiser_name: v })} />
              <FieldInput label="External Reference #" value={form.external_ref} onChange={(v) => set({ external_ref: v })} />
              <div className="appr-field">
                <label className="appr-label">Appraisal Type</label>
                <select className="appr-select" value={form.appraisal_type} onChange={(e) => set({ appraisal_type: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="full">Full Appraisal (URAR)</option>
                  <option value="desktop">Desktop</option>
                  <option value="avm">AVM</option>
                  <option value="drive_by">Drive-By (2055)</option>
                  <option value="review">Appraisal Review</option>
                  <option value="second">Second Appraisal</option>
                </select>
              </div>
            </div>
          </section>

          {/* Valuation */}
          <section className="appr-section">
            <h3 className="appr-section-title">Valuation</h3>
            <div className="appr-field-grid">
              <FieldInput label="Appraised Value ($)" value={form.appraised_value} onChange={(v) => set({ appraised_value: v })} type="number" />
              <FieldInput label="Purchase Price ($)" value={form.purchase_price} onChange={(v) => set({ purchase_price: v })} type="number" />
              <div className="appr-field">
                <label className="appr-label">Property Condition</label>
                <select className="appr-select" value={form.property_condition} onChange={(e) => set({ property_condition: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="C1">C1 — New</option>
                  <option value="C2">C2 — Near New</option>
                  <option value="C3">C3 — Well-Maintained</option>
                  <option value="C4">C4 — Adequately Maintained</option>
                  <option value="C5">C5 — Fair Condition</option>
                  <option value="C6">C6 — Poor Condition</option>
                </select>
              </div>
            </div>
          </section>

          {/* Review */}
          <section className="appr-section">
            <h3 className="appr-section-title">Review &amp; Clearance</h3>
            <div className="appr-field-grid">
              <div className="appr-field">
                <label className="appr-label">Review Status</label>
                <select className="appr-select" value={form.review_status} onChange={(e) => set({ review_status: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="cleared">Cleared</option>
                  <option value="rejected">Rejected</option>
                  <option value="rov_requested">ROV Requested</option>
                </select>
              </div>
              <FieldInput label="Reviewed By" value={form.reviewed_by} onChange={(v) => set({ reviewed_by: v })} />
              <FieldInput label="Review Date" value={form.review_date} onChange={(v) => set({ review_date: v })} type="date" />
            </div>
            <div className="appr-checkboxes">
              <CheckField label="Reconsideration of Value (ROV) Requested" checked={form.has_rov} onChange={(v) => set({ has_rov: v })} />
              <CheckField label="Second Appraisal Required" checked={form.second_appraisal} onChange={(v) => set({ second_appraisal: v })} />
            </div>
            <div className="appr-field appr-field--full">
              <label className="appr-label">Review Notes</label>
              <textarea
                className="appr-textarea"
                rows={4}
                placeholder="Reviewer notes, issues, conditions for clearance…"
                value={form.review_notes}
                onChange={(e) => set({ review_notes: e.target.value })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="appr-field">
      <label className="appr-label">{label}</label>
      <input type={type} className="appr-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="appr-check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
