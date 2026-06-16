import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { WorkspaceSaveBar } from "@/components/loans/workspace/WorkspaceSaveBar";
import type { LoanSummary } from "@/types/loan";
import type { PropertyDetailOut } from "@/types/api";

type Props = { loan: LoanSummary };

type PropForm = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  county: string;
  census_tract: string;
  msa: string;
  apn: string;
  property_type: string;
  occupancy: string;
  year_built: string;
  square_footage: string;
  lot_size_sqft: string;
  units: string;
  is_mixed_use: boolean;
  is_rural: boolean;
  is_condo_pud: boolean;
  flood_zone: string;
  flood_insurance_required: boolean;
  annual_taxes: string;
  hazard_insurance: string;
  hoa_dues: string;
  value_source: string;
  estimated_value: string;
};

const EMPTY: PropForm = {
  address1: "", address2: "", city: "", state: "", postal_code: "",
  county: "", census_tract: "", msa: "", apn: "",
  property_type: "", occupancy: "", year_built: "", square_footage: "",
  lot_size_sqft: "", units: "", is_mixed_use: false, is_rural: false,
  is_condo_pud: false, flood_zone: "", flood_insurance_required: false,
  annual_taxes: "", hazard_insurance: "", hoa_dues: "",
  value_source: "", estimated_value: "",
};

function toForm(p: PropertyDetailOut): PropForm {
  return {
    address1: p.address1 ?? "",
    address2: p.address2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    postal_code: p.postal_code ?? "",
    county: p.county ?? "",
    census_tract: p.census_tract ?? "",
    msa: p.msa ?? "",
    apn: p.apn ?? "",
    property_type: p.property_type ?? "",
    occupancy: p.occupancy ?? "",
    year_built: p.year_built != null ? String(p.year_built) : "",
    square_footage: p.square_footage != null ? String(p.square_footage) : "",
    lot_size_sqft: p.lot_size_sqft != null ? String(p.lot_size_sqft) : "",
    units: p.units != null ? String(p.units) : "",
    is_mixed_use: p.is_mixed_use ?? false,
    is_rural: p.is_rural ?? false,
    is_condo_pud: p.is_condo_pud ?? false,
    flood_zone: p.flood_zone ?? "",
    flood_insurance_required: p.flood_insurance_required ?? false,
    annual_taxes: p.annual_taxes != null ? String(p.annual_taxes) : "",
    hazard_insurance: p.hazard_insurance != null ? String(p.hazard_insurance) : "",
    hoa_dues: p.hoa_dues != null ? String(p.hoa_dues) : "",
    value_source: p.value_source ?? "",
    estimated_value: p.estimated_value != null ? String(p.estimated_value) : "",
  };
}

export function WorkspaceSubjectProperty({ loan }: Props) {
  const { token } = useAuth();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [form, setForm] = useState<PropForm>(EMPTY);
  const [saved, setSaved] = useState<PropForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<PropertyDetailOut[]>(`/properties/?loan_id=${loan.id}`, { token })
      .then((list) => {
        if (cancelled) return;
        const subject = list.find((p) => p.is_subject) ?? list[0] ?? null;
        if (subject) {
          setPropertyId(subject.id);
          const f = toForm(subject);
          setForm(f);
          setSaved(f);
        }
      })
      .catch(() => { /* no property yet */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(patch: Partial<PropForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSave() {
    if (!token || !propertyId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        address1: form.address1 || null,
        address2: form.address2 || null,
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        county: form.county || null,
        census_tract: form.census_tract || null,
        msa: form.msa || null,
        apn: form.apn || null,
        property_type: form.property_type || null,
        occupancy: form.occupancy || null,
        year_built: form.year_built ? Number(form.year_built) : null,
        square_footage: form.square_footage ? Number(form.square_footage) : null,
        lot_size_sqft: form.lot_size_sqft ? Number(form.lot_size_sqft) : null,
        units: form.units ? Number(form.units) : null,
        is_mixed_use: form.is_mixed_use,
        is_rural: form.is_rural,
        is_condo_pud: form.is_condo_pud,
        flood_zone: form.flood_zone || null,
        flood_insurance_required: form.flood_insurance_required,
        annual_taxes: form.annual_taxes ? Number(form.annual_taxes) : null,
        hazard_insurance: form.hazard_insurance ? Number(form.hazard_insurance) : null,
        hoa_dues: form.hoa_dues ? Number(form.hoa_dues) : null,
        value_source: form.value_source || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      };
      await apiRequest(`/properties/${propertyId}`, { token, method: "PATCH", body: JSON.stringify(payload) });
      setSaved(form);
      setSaveCount((c) => c + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unable to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="prop-wrapper">
      <WorkspaceSaveBar
        title="Subject Property"
        subtitle={loan.loanNumber}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        saveCount={saveCount}
        onSave={handleSave}
        onCancel={() => setForm(saved)}
      />

      {loading ? (
        <div className="prop-loading">Loading property…</div>
      ) : (
        <div className="prop-content">
          {/* Address */}
          <section className="prop-section">
            <h3 className="prop-section-title">Property Address</h3>
            <div className="prop-field-grid">
              <FieldInput label="Street Address" value={form.address1} onChange={(v) => set({ address1: v })} className="prop-field--span2" />
              <FieldInput label="Unit / Suite" value={form.address2} onChange={(v) => set({ address2: v })} />
              <FieldInput label="City" value={form.city} onChange={(v) => set({ city: v })} />
              <FieldInput label="State" value={form.state} onChange={(v) => set({ state: v })} />
              <FieldInput label="ZIP Code" value={form.postal_code} onChange={(v) => set({ postal_code: v })} />
              <FieldInput label="County" value={form.county} onChange={(v) => set({ county: v })} />
              <FieldInput label="APN" value={form.apn} onChange={(v) => set({ apn: v })} />
              <FieldInput label="Census Tract" value={form.census_tract} onChange={(v) => set({ census_tract: v })} />
              <FieldInput label="MSA" value={form.msa} onChange={(v) => set({ msa: v })} />
            </div>
          </section>

          {/* Characteristics */}
          <section className="prop-section">
            <h3 className="prop-section-title">Property Characteristics</h3>
            <div className="prop-field-grid">
              <div className="prop-field">
                <label className="prop-label">Property Type</label>
                <select className="prop-select" value={form.property_type} onChange={(e) => set({ property_type: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="single_family">Single Family</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="2_4_unit">2–4 Unit</option>
                  <option value="5_plus_unit">5+ Unit</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="land">Land</option>
                  <option value="manufactured">Manufactured</option>
                  <option value="commercial">Commercial</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="prop-field">
                <label className="prop-label">Occupancy</label>
                <select className="prop-select" value={form.occupancy} onChange={(e) => set({ occupancy: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="primary">Primary Residence</option>
                  <option value="second_home">Second Home</option>
                  <option value="investment">Investment / Rental</option>
                </select>
              </div>
              <FieldInput label="Year Built" value={form.year_built} onChange={(v) => set({ year_built: v })} type="number" />
              <FieldInput label="Square Footage" value={form.square_footage} onChange={(v) => set({ square_footage: v })} type="number" />
              <FieldInput label="Lot Size (sqft)" value={form.lot_size_sqft} onChange={(v) => set({ lot_size_sqft: v })} type="number" />
              <FieldInput label="Units" value={form.units} onChange={(v) => set({ units: v })} type="number" />
            </div>
            <div className="prop-checkboxes">
              <CheckField label="Mixed Use" checked={form.is_mixed_use} onChange={(v) => set({ is_mixed_use: v })} />
              <CheckField label="Rural Property" checked={form.is_rural} onChange={(v) => set({ is_rural: v })} />
              <CheckField label="Condo / PUD" checked={form.is_condo_pud} onChange={(v) => set({ is_condo_pud: v })} />
            </div>
          </section>

          {/* Flood */}
          <section className="prop-section">
            <h3 className="prop-section-title">Flood Information</h3>
            <div className="prop-field-grid">
              <FieldInput label="Flood Zone" value={form.flood_zone} onChange={(v) => set({ flood_zone: v })} placeholder="e.g. AE, X, VE" />
              <div className="prop-field">
                <CheckField label="Flood Insurance Required" checked={form.flood_insurance_required} onChange={(v) => set({ flood_insurance_required: v })} />
              </div>
            </div>
          </section>

          {/* Valuation & taxes */}
          <section className="prop-section">
            <h3 className="prop-section-title">Valuation &amp; Taxes</h3>
            <div className="prop-field-grid">
              <div className="prop-field">
                <label className="prop-label">Value Source</label>
                <select className="prop-select" value={form.value_source} onChange={(e) => set({ value_source: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="appraisal">Appraisal</option>
                  <option value="bpo">BPO</option>
                  <option value="avm">AVM</option>
                  <option value="purchase_price">Purchase Price</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <FieldInput label="Estimated Value ($)" value={form.estimated_value} onChange={(v) => set({ estimated_value: v })} type="number" />
              <FieldInput label="Annual Taxes ($)" value={form.annual_taxes} onChange={(v) => set({ annual_taxes: v })} type="number" />
              <FieldInput label="Hazard Insurance ($/yr)" value={form.hazard_insurance} onChange={(v) => set({ hazard_insurance: v })} type="number" />
              <FieldInput label="HOA Dues ($/mo)" value={form.hoa_dues} onChange={(v) => set({ hoa_dues: v })} type="number" />
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
    <div className={`prop-field${className ? ` ${className}` : ""}`}>
      <label className="prop-label">{label}</label>
      <input
        type={type}
        className="prop-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="prop-check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
