import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import type { LoanSummary } from "@/types/loan";
import type { TitleOrderOut, TitleExceptionOut } from "@/types/api";

type Props = { loan: LoanSummary };

type OrderForm = {
  company_name: string;
  officer_name: string;
  officer_email: string;
  officer_phone: string;
  ordered_date: string;
  commitment_received_date: string;
  title_status: string;
  external_ref: string;
  borrower_vesting: string;
  ownership_type: string;
  entity_vesting: string;
  vesting_notes: string;
  cleared_date: string;
  cleared_by: string;
  funding_blocked: boolean;
  funding_block_reason: string;
  legal_review_required: boolean;
  legal_reviewer: string;
  legal_review_status: string;
  legal_review_notes: string;
  notes: string;
};

const ORDER_EMPTY: OrderForm = {
  company_name: "", officer_name: "", officer_email: "", officer_phone: "",
  ordered_date: "", commitment_received_date: "", title_status: "pending",
  external_ref: "", borrower_vesting: "", ownership_type: "", entity_vesting: "",
  vesting_notes: "", cleared_date: "", cleared_by: "", funding_blocked: false,
  funding_block_reason: "", legal_review_required: false, legal_reviewer: "",
  legal_review_status: "", legal_review_notes: "", notes: "",
};

function toOrderForm(o: TitleOrderOut): OrderForm {
  return {
    company_name: o.company_name ?? "",
    officer_name: o.officer_name ?? "",
    officer_email: o.officer_email ?? "",
    officer_phone: o.officer_phone ?? "",
    ordered_date: o.ordered_date ?? "",
    commitment_received_date: o.commitment_received_date ?? "",
    title_status: o.title_status ?? "pending",
    external_ref: o.external_ref ?? "",
    borrower_vesting: o.borrower_vesting ?? "",
    ownership_type: o.ownership_type ?? "",
    entity_vesting: o.entity_vesting ?? "",
    vesting_notes: o.vesting_notes ?? "",
    cleared_date: o.cleared_date ?? "",
    cleared_by: o.cleared_by ?? "",
    funding_blocked: o.funding_blocked,
    funding_block_reason: o.funding_block_reason ?? "",
    legal_review_required: o.legal_review_required,
    legal_reviewer: o.legal_reviewer ?? "",
    legal_review_status: o.legal_review_status ?? "",
    legal_review_notes: o.legal_review_notes ?? "",
    notes: o.notes ?? "",
  };
}

const EXCEPTION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  cleared: "Cleared",
  waived: "Waived",
};

function statusTone(s: string) {
  if (s === "cleared" || s === "waived") return "green";
  if (s === "in_review") return "amber";
  return "red";
}

export function WorkspaceTitleLegal({ loan }: Props) {
  const { token } = useAuth();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderForm>(ORDER_EMPTY);
  const [saved, setSaved] = useState<OrderForm>(ORDER_EMPTY);
  const [exceptions, setExceptions] = useState<TitleExceptionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [creating, setCreating] = useState(false);

  // New exception form state
  const [addingException, setAddingException] = useState(false);
  const [excForm, setExcForm] = useState({ exception_type: "", description: "", holder_name: "", amount: "" });
  const [excSaving, setExcSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiRequest<TitleOrderOut[]>(`/title/orders?loan_id=${loan.id}`, { token }),
      apiRequest<TitleExceptionOut[]>(`/title/exceptions?loan_id=${loan.id}`, { token }),
    ])
      .then(([orders, excs]) => {
        if (cancelled) return;
        setExceptions(excs);
        const order = orders[0] ?? null;
        if (order) {
          setOrderId(order.id);
          const f = toOrderForm(order);
          setForm(f);
          setSaved(f);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(patch: Partial<OrderForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleCreate() {
    if (!token) return;
    setCreating(true);
    try {
      const created = await apiRequest<TitleOrderOut>(`/title/orders`, {
        token, method: "POST",
        body: JSON.stringify({ loan_id: loan.id, title_status: "pending" }),
      });
      setOrderId(created.id);
      const f = toOrderForm(created);
      setForm(f);
      setSaved(f);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not create title order");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!token || !orderId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        company_name: form.company_name || null,
        officer_name: form.officer_name || null,
        officer_email: form.officer_email || null,
        officer_phone: form.officer_phone || null,
        ordered_date: form.ordered_date || null,
        commitment_received_date: form.commitment_received_date || null,
        title_status: form.title_status,
        external_ref: form.external_ref || null,
        borrower_vesting: form.borrower_vesting || null,
        ownership_type: form.ownership_type || null,
        entity_vesting: form.entity_vesting || null,
        vesting_notes: form.vesting_notes || null,
        cleared_date: form.cleared_date || null,
        cleared_by: form.cleared_by || null,
        funding_blocked: form.funding_blocked,
        funding_block_reason: form.funding_block_reason || null,
        legal_review_required: form.legal_review_required,
        legal_reviewer: form.legal_reviewer || null,
        legal_review_status: form.legal_review_status || null,
        legal_review_notes: form.legal_review_notes || null,
        notes: form.notes || null,
      };
      await apiRequest(`/title/orders/${orderId}`, { token, method: "PATCH", body: JSON.stringify(payload) });
      setSaved(form);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddException() {
    if (!token) return;
    setExcSaving(true);
    try {
      const created = await apiRequest<TitleExceptionOut>(`/title/exceptions`, {
        token, method: "POST",
        body: JSON.stringify({
          loan_id: loan.id,
          title_order_id: orderId || null,
          exception_type: excForm.exception_type || "other",
          description: excForm.description || null,
          holder_name: excForm.holder_name || null,
          amount: excForm.amount ? Number(excForm.amount) : null,
          exception_status: "open",
        }),
      });
      setExceptions((prev) => [created, ...prev]);
      setAddingException(false);
      setExcForm({ exception_type: "", description: "", holder_name: "", amount: "" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not add exception");
    } finally {
      setExcSaving(false);
    }
  }

  async function handleClearException(excId: string) {
    if (!token) return;
    try {
      const updated = await apiRequest<TitleExceptionOut>(`/title/exceptions/${excId}`, {
        token, method: "PATCH",
        body: JSON.stringify({ exception_status: "cleared", cleared_date: new Date().toISOString().slice(0, 10) }),
      });
      setExceptions((prev) => prev.map((e) => e.id === excId ? updated : e));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not clear exception");
    }
  }

  const openExceptionCount = exceptions.filter((e) => e.exception_status === "open" || e.exception_status === "in_review").length;

  return (
    <div className="title-wrapper">
      <WorkspaceSaveBar
        title="Title &amp; Legal"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      {loading ? (
        <div className="title-loading">Loading title order…</div>
      ) : !orderId ? (
        <div className="title-empty">
          <p>No title order on file for this loan.</p>
          <button type="button" className="title-create-btn" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Open Title Order"}
          </button>
          {saveError && <div className="title-error">{saveError}</div>}
        </div>
      ) : (
        <div className="title-content">
          {/* Title company */}
          <section className="title-section">
            <h3 className="title-section-title">Title Company</h3>
            <div className="title-field-grid">
              <FieldInput label="Company Name" value={form.company_name} onChange={(v) => set({ company_name: v })} className="title-field--span2" />
              <FieldInput label="Officer Name" value={form.officer_name} onChange={(v) => set({ officer_name: v })} />
              <FieldInput label="Officer Email" value={form.officer_email} onChange={(v) => set({ officer_email: v })} type="email" />
              <FieldInput label="Officer Phone" value={form.officer_phone} onChange={(v) => set({ officer_phone: v })} type="tel" />
              <FieldInput label="External Reference #" value={form.external_ref} onChange={(v) => set({ external_ref: v })} />
              <FieldInput label="Ordered Date" value={form.ordered_date} onChange={(v) => set({ ordered_date: v })} type="date" />
              <FieldInput label="Commitment Received" value={form.commitment_received_date} onChange={(v) => set({ commitment_received_date: v })} type="date" />
              <div className="title-field">
                <label className="title-label">Title Status</label>
                <select className="title-select" value={form.title_status} onChange={(e) => set({ title_status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                  <option value="in_review">In Review</option>
                  <option value="cleared">Cleared</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <FieldInput label="Cleared Date" value={form.cleared_date} onChange={(v) => set({ cleared_date: v })} type="date" />
              <FieldInput label="Cleared By" value={form.cleared_by} onChange={(v) => set({ cleared_by: v })} />
            </div>
          </section>

          {/* Vesting */}
          <section className="title-section">
            <h3 className="title-section-title">Vesting</h3>
            <div className="title-field-grid">
              <FieldInput label="Borrower Vesting" value={form.borrower_vesting} onChange={(v) => set({ borrower_vesting: v })} className="title-field--span2" />
              <div className="title-field">
                <label className="title-label">Ownership Type</label>
                <select className="title-select" value={form.ownership_type} onChange={(e) => set({ ownership_type: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="sole_and_separate">Sole and Separate</option>
                  <option value="joint_tenancy">Joint Tenancy</option>
                  <option value="community_property">Community Property</option>
                  <option value="tenants_in_common">Tenants in Common</option>
                  <option value="trust">Trust</option>
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                </select>
              </div>
              <FieldInput label="Entity / Trust Name" value={form.entity_vesting} onChange={(v) => set({ entity_vesting: v })} className="title-field--span2" />
            </div>
            <div className="title-field title-field--full">
              <label className="title-label">Vesting Notes</label>
              <textarea className="title-textarea" rows={2} value={form.vesting_notes} onChange={(e) => set({ vesting_notes: e.target.value })} />
            </div>
          </section>

          {/* Exceptions */}
          <section className="title-section">
            <div className="title-section-header">
              <h3 className="title-section-title">
                Title Exceptions
                {openExceptionCount > 0 && (
                  <span className="title-exception-badge">{openExceptionCount} open</span>
                )}
              </h3>
              <button type="button" className="title-add-exc-btn" onClick={() => setAddingException(true)}>
                + Add Exception
              </button>
            </div>

            {addingException && (
              <div className="title-exc-form">
                <div className="title-exc-form-grid">
                  <div className="title-field">
                    <label className="title-label">Type</label>
                    <select className="title-select" value={excForm.exception_type} onChange={(e) => setExcForm((f) => ({ ...f, exception_type: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="lien">Lien</option>
                      <option value="easement">Easement</option>
                      <option value="encroachment">Encroachment</option>
                      <option value="restriction">Restriction / CC&R</option>
                      <option value="judgment">Judgment</option>
                      <option value="tax_lien">Tax Lien</option>
                      <option value="hoa_lien">HOA Lien</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="title-field">
                    <label className="title-label">Holder</label>
                    <input className="title-input" value={excForm.holder_name} onChange={(e) => setExcForm((f) => ({ ...f, holder_name: e.target.value }))} />
                  </div>
                  <div className="title-field">
                    <label className="title-label">Amount ($)</label>
                    <input type="number" className="title-input" value={excForm.amount} onChange={(e) => setExcForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="title-field title-field--span2">
                    <label className="title-label">Description</label>
                    <textarea className="title-textarea" rows={2} value={excForm.description} onChange={(e) => setExcForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <div className="title-exc-form-actions">
                  <button type="button" className="title-exc-cancel" onClick={() => setAddingException(false)}>Cancel</button>
                  <button type="button" className="title-exc-save" onClick={handleAddException} disabled={excSaving}>
                    {excSaving ? "Saving…" : "Add Exception"}
                  </button>
                </div>
              </div>
            )}

            {exceptions.length === 0 && !addingException ? (
              <div className="title-empty-row">No exceptions on file. Clear title.</div>
            ) : (
              <div className="title-exceptions-list">
                {exceptions.map((exc) => (
                  <article key={exc.id} className={`title-exception-card title-exception-card--${statusTone(exc.exception_status)}`}>
                    <div className="title-exception-head">
                      <strong>{exc.exception_type}</strong>
                      <span className={`title-exc-status title-exc-status--${statusTone(exc.exception_status)}`}>
                        {EXCEPTION_STATUS_LABELS[exc.exception_status] ?? exc.exception_status}
                      </span>
                    </div>
                    {exc.holder_name && <div className="title-exception-holder">Holder: {exc.holder_name}</div>}
                    {exc.amount != null && (
                      <div className="title-exception-amount">
                        ${exc.amount.toLocaleString()}
                      </div>
                    )}
                    {exc.description && <p className="title-exception-desc">{exc.description}</p>}
                    {(exc.exception_status === "open" || exc.exception_status === "in_review") && (
                      <button
                        type="button"
                        className="title-exc-clear-btn"
                        onClick={() => handleClearException(exc.id)}
                      >
                        Mark Cleared
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Funding block */}
          {(form.funding_blocked || form.legal_review_required) && (
            <section className="title-section title-section--alert">
              {form.funding_blocked && (
                <div className="title-alert-block">
                  <strong>Funding Blocked</strong>
                  <span>{form.funding_block_reason || "No reason specified"}</span>
                </div>
              )}
            </section>
          )}

          {/* Legal review */}
          <section className="title-section">
            <h3 className="title-section-title">Legal Review</h3>
            <div className="title-checkboxes">
              <CheckField label="Funding Blocked" checked={form.funding_blocked} onChange={(v) => set({ funding_blocked: v })} />
              <CheckField label="Legal Review Required" checked={form.legal_review_required} onChange={(v) => set({ legal_review_required: v })} />
            </div>
            {form.funding_blocked && (
              <FieldInput label="Block Reason" value={form.funding_block_reason} onChange={(v) => set({ funding_block_reason: v })} className="title-field--full" />
            )}
            {form.legal_review_required && (
              <div className="title-field-grid">
                <FieldInput label="Legal Reviewer" value={form.legal_reviewer} onChange={(v) => set({ legal_reviewer: v })} />
                <div className="title-field">
                  <label className="title-label">Legal Review Status</label>
                  <select className="title-select" value={form.legal_review_status} onChange={(e) => set({ legal_review_status: e.target.value })}>
                    <option value="">— Select —</option>
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="cleared">Cleared</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="title-field title-field--span2">
                  <label className="title-label">Legal Review Notes</label>
                  <textarea className="title-textarea" rows={3} value={form.legal_review_notes} onChange={(e) => set({ legal_review_notes: e.target.value })} />
                </div>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="title-section">
            <h3 className="title-section-title">Notes</h3>
            <div className="title-field title-field--full">
              <textarea
                className="title-textarea"
                rows={4}
                placeholder="Title notes, outstanding items, follow-up…"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  label, value, onChange, type = "text", placeholder, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={`title-field${className ? ` ${className}` : ""}`}>
      <label className="title-label">{label}</label>
      <input type={type} className="title-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="title-check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
