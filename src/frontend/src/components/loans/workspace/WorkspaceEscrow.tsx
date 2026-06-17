import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import type { LoanSummary } from "@/types/loan";
import type { EscrowDetailOut } from "@/types/api";

type Props = { loan: LoanSummary };

type EscrowForm = {
  company_name: string;
  officer_name: string;
  officer_email: string;
  officer_phone: string;
  company_address: string;
  escrow_number: string;
  contract_date: string;
  closing_date: string;
  settlement_agent: string;
  earnest_money_deposit: string;
  wire_instructions_status: string;
  estimated_cash_to_close: string;
  verified_cash_to_close: string;
  seller_credits: string;
  lender_credits: string;
  third_party_fees: string;
  escrow_balance: string;
  closing_protection_letter: boolean;
  settlement_stmt_reviewed: boolean;
  wire_verified: boolean;
  notes: string;
};

const EMPTY: EscrowForm = {
  company_name: "", officer_name: "", officer_email: "", officer_phone: "",
  company_address: "", escrow_number: "", contract_date: "", closing_date: "",
  settlement_agent: "", earnest_money_deposit: "", wire_instructions_status: "",
  estimated_cash_to_close: "", verified_cash_to_close: "", seller_credits: "",
  lender_credits: "", third_party_fees: "", escrow_balance: "",
  closing_protection_letter: false, settlement_stmt_reviewed: false, wire_verified: false,
  notes: "",
};

function toForm(e: EscrowDetailOut): EscrowForm {
  return {
    company_name: e.company_name ?? "",
    officer_name: e.officer_name ?? "",
    officer_email: e.officer_email ?? "",
    officer_phone: e.officer_phone ?? "",
    company_address: e.company_address ?? "",
    escrow_number: e.escrow_number ?? "",
    contract_date: e.contract_date ?? "",
    closing_date: e.closing_date ?? "",
    settlement_agent: e.settlement_agent ?? "",
    earnest_money_deposit: e.earnest_money_deposit != null ? String(e.earnest_money_deposit) : "",
    wire_instructions_status: e.wire_instructions_status ?? "",
    estimated_cash_to_close: e.estimated_cash_to_close != null ? String(e.estimated_cash_to_close) : "",
    verified_cash_to_close: e.verified_cash_to_close != null ? String(e.verified_cash_to_close) : "",
    seller_credits: e.seller_credits != null ? String(e.seller_credits) : "",
    lender_credits: e.lender_credits != null ? String(e.lender_credits) : "",
    third_party_fees: e.third_party_fees != null ? String(e.third_party_fees) : "",
    escrow_balance: e.escrow_balance != null ? String(e.escrow_balance) : "",
    closing_protection_letter: e.closing_protection_letter,
    settlement_stmt_reviewed: e.settlement_stmt_reviewed,
    wire_verified: e.wire_verified,
    notes: e.notes ?? "",
  };
}

export function WorkspaceEscrow({ loan }: Props) {
  const { token } = useAuth();
  const [form, setForm] = useState<EscrowForm>(EMPTY);
  const [saved, setSaved] = useState<EscrowForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [hasRecord, setHasRecord] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<EscrowDetailOut>(`/escrow/${loan.id}`, { token })
      .then((e) => {
        if (cancelled) return;
        setHasRecord(true);
        const f = toForm(e);
        setForm(f);
        setSaved(f);
      })
      .catch(() => { if (!cancelled) setHasRecord(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(patch: Partial<EscrowForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleCreate() {
    if (!token) return;
    setCreating(true);
    try {
      const created = await apiRequest<EscrowDetailOut>(`/escrow/${loan.id}`, {
        token, method: "PUT", body: JSON.stringify({}),
      });
      setHasRecord(true);
      const f = toForm(created);
      setForm(f);
      setSaved(f);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not create escrow record");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!token) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        company_name: form.company_name || null,
        officer_name: form.officer_name || null,
        officer_email: form.officer_email || null,
        officer_phone: form.officer_phone || null,
        company_address: form.company_address || null,
        escrow_number: form.escrow_number || null,
        contract_date: form.contract_date || null,
        closing_date: form.closing_date || null,
        settlement_agent: form.settlement_agent || null,
        earnest_money_deposit: form.earnest_money_deposit ? Number(form.earnest_money_deposit) : null,
        wire_instructions_status: form.wire_instructions_status || null,
        estimated_cash_to_close: form.estimated_cash_to_close ? Number(form.estimated_cash_to_close) : null,
        verified_cash_to_close: form.verified_cash_to_close ? Number(form.verified_cash_to_close) : null,
        seller_credits: form.seller_credits ? Number(form.seller_credits) : null,
        lender_credits: form.lender_credits ? Number(form.lender_credits) : null,
        third_party_fees: form.third_party_fees ? Number(form.third_party_fees) : null,
        escrow_balance: form.escrow_balance ? Number(form.escrow_balance) : null,
        closing_protection_letter: form.closing_protection_letter,
        settlement_stmt_reviewed: form.settlement_stmt_reviewed,
        wire_verified: form.wire_verified,
        notes: form.notes || null,
      };
      const updated = await apiRequest<EscrowDetailOut>(`/escrow/${loan.id}`, {
        token, method: "PUT", body: JSON.stringify(payload),
      });
      const f = toForm(updated);
      setForm(f);
      setSaved(f);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="escrow-wrapper">
      <WorkspaceSaveBar
        title="Escrow"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      {loading ? (
        <div className="escrow-loading">Loading escrow…</div>
      ) : !hasRecord ? (
        <div className="escrow-empty">
          <p>No escrow record on file for this loan.</p>
          <button type="button" className="escrow-create-btn" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Open Escrow"}
          </button>
          {saveError && <div className="escrow-error">{saveError}</div>}
        </div>
      ) : (
        <div className="escrow-content">
          {/* Contact */}
          <section className="escrow-section">
            <h3 className="escrow-section-title">Escrow Contact</h3>
            <div className="escrow-field-grid">
              <FieldInput label="Company Name" value={form.company_name} onChange={(v) => set({ company_name: v })} className="escrow-field--span2" />
              <FieldInput label="Officer Name" value={form.officer_name} onChange={(v) => set({ officer_name: v })} />
              <FieldInput label="Officer Email" value={form.officer_email} onChange={(v) => set({ officer_email: v })} type="email" />
              <FieldInput label="Officer Phone" value={form.officer_phone} onChange={(v) => set({ officer_phone: v })} type="tel" />
              <FieldInput label="Company Address" value={form.company_address} onChange={(v) => set({ company_address: v })} className="escrow-field--span2" />
              <FieldInput label="Escrow Number" value={form.escrow_number} onChange={(v) => set({ escrow_number: v })} />
              <FieldInput label="Settlement Agent" value={form.settlement_agent} onChange={(v) => set({ settlement_agent: v })} />
            </div>
          </section>

          {/* Dates */}
          <section className="escrow-section">
            <h3 className="escrow-section-title">Key Dates</h3>
            <div className="escrow-field-grid">
              <FieldInput label="Contract Date" value={form.contract_date} onChange={(v) => set({ contract_date: v })} type="date" />
              <FieldInput label="Closing Date" value={form.closing_date} onChange={(v) => set({ closing_date: v })} type="date" />
            </div>
          </section>

          {/* Settlement */}
          <section className="escrow-section">
            <h3 className="escrow-section-title">Settlement Summary</h3>
            <div className="escrow-field-grid">
              <FieldInput label="Earnest Money Deposit ($)" value={form.earnest_money_deposit} onChange={(v) => set({ earnest_money_deposit: v })} type="number" />
              <FieldInput label="Estimated Cash to Close ($)" value={form.estimated_cash_to_close} onChange={(v) => set({ estimated_cash_to_close: v })} type="number" />
              <FieldInput label="Verified Cash to Close ($)" value={form.verified_cash_to_close} onChange={(v) => set({ verified_cash_to_close: v })} type="number" />
              <FieldInput label="Seller Credits ($)" value={form.seller_credits} onChange={(v) => set({ seller_credits: v })} type="number" />
              <FieldInput label="Lender Credits ($)" value={form.lender_credits} onChange={(v) => set({ lender_credits: v })} type="number" />
              <FieldInput label="Third-Party Fees ($)" value={form.third_party_fees} onChange={(v) => set({ third_party_fees: v })} type="number" />
              <FieldInput label="Escrow Balance ($)" value={form.escrow_balance} onChange={(v) => set({ escrow_balance: v })} type="number" />
              <div className="escrow-field">
                <label className="escrow-label">Wire Instructions Status</label>
                <select className="escrow-select" value={form.wire_instructions_status} onChange={(e) => set({ wire_instructions_status: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="not_received">Not Received</option>
                  <option value="received">Received</option>
                  <option value="verified">Verified</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
            </div>
          </section>

          {/* Checklist */}
          <section className="escrow-section">
            <h3 className="escrow-section-title">Clearance Checklist</h3>
            <div className="escrow-checklist">
              <CheckField label="Closing Protection Letter Received" checked={form.closing_protection_letter} onChange={(v) => set({ closing_protection_letter: v })} />
              <CheckField label="Settlement Statement Reviewed" checked={form.settlement_stmt_reviewed} onChange={(v) => set({ settlement_stmt_reviewed: v })} />
              <CheckField label="Wire Verified" checked={form.wire_verified} onChange={(v) => set({ wire_verified: v })} />
            </div>
          </section>

          {/* Notes */}
          <section className="escrow-section">
            <h3 className="escrow-section-title">Notes</h3>
            <div className="escrow-field escrow-field--full">
              <textarea
                className="escrow-textarea"
                rows={4}
                placeholder="Escrow notes, issues, follow-up items…"
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
    <div className={`escrow-field${className ? ` ${className}` : ""}`}>
      <label className="escrow-label">{label}</label>
      <input type={type} className="escrow-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="escrow-check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
