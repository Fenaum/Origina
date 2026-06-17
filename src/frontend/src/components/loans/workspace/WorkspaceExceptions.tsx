import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import type { ExceptionFactor, ExceptionOut, ExceptionSeverity, ExceptionStatus } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// ── Controlled value definitions ──────────────────────────────────────────────
// Mirror exception_schema.py constants. Keep in sync.

const PRIMARY_CATEGORIES: { value: string; label: string }[] = [
  { value: "credit",           label: "Credit" },
  { value: "collateral",       label: "Collateral" },
  { value: "income",           label: "Income" },
  { value: "assets_reserves",  label: "Assets / Reserves" },
  { value: "pricing",          label: "Pricing" },
  { value: "product_guideline",label: "Product / Guideline" },
  { value: "broker_account",   label: "Broker / Account" },
  { value: "documentation",    label: "Documentation" },
  { value: "compliance",       label: "Compliance" },
  { value: "other",            label: "Other" },
];

const EXCEPTION_TYPES: { value: string; label: string }[] = [
  { value: "ltv",            label: "LTV Exception" },
  { value: "cltv",           label: "CLTV Exception" },
  { value: "credit_score",   label: "Credit Score Exception" },
  { value: "dscr",           label: "DSCR Exception" },
  { value: "dti",            label: "DTI Exception" },
  { value: "reserves",       label: "Reserve Exception" },
  { value: "price_match",    label: "Price Match Exception" },
  { value: "rate",           label: "Rate Exception" },
  { value: "fee",            label: "Fee Exception" },
  { value: "loan_amount",    label: "Loan Amount Exception" },
  { value: "occupancy",      label: "Occupancy Exception" },
  { value: "property_type",  label: "Property Type Exception" },
  { value: "seasoning",      label: "Seasoning Exception" },
  { value: "documentation",  label: "Documentation Exception" },
  { value: "broker_approval",label: "Broker Approval Exception" },
  { value: "income_type",    label: "Income Type Exception" },
  { value: "employment",     label: "Employment Exception" },
  { value: "other",          label: "Other" },
];

const REASON_CODES: { value: string; label: string }[] = [
  { value: "strong_borrower_profile",    label: "Strong Borrower Profile" },
  { value: "minor_guideline_variance",   label: "Minor Guideline Variance" },
  { value: "competitive_price_match",    label: "Competitive Price Match" },
  { value: "investor_relationship",      label: "Investor Relationship" },
  { value: "strategic_broker_relationship", label: "Strategic Broker Relationship" },
  { value: "operational_exception",      label: "Operational Exception" },
  { value: "prior_approval_precedent",   label: "Prior Approval Precedent" },
  { value: "compensating_risk_profile",  label: "Compensating Risk Profile" },
  { value: "other",                      label: "Other" },
];

const METRIC_TYPES: { value: string; label: string }[] = [
  { value: "ltv",         label: "LTV (%)" },
  { value: "cltv",        label: "CLTV (%)" },
  { value: "fico",        label: "FICO Score" },
  { value: "dti",         label: "DTI (%)" },
  { value: "dscr",        label: "DSCR" },
  { value: "rate",        label: "Rate (%)" },
  { value: "months",      label: "Months" },
  { value: "loan_amount", label: "Loan Amount ($)" },
  { value: "other",       label: "Other" },
];

const VARIANCE_UNITS: { value: string; label: string }[] = [
  { value: "pct",     label: "%" },
  { value: "bps",     label: "bps" },
  { value: "months",  label: "months" },
  { value: "dollars", label: "$" },
  { value: "points",  label: "points" },
];

const COMPENSATING_FACTORS: { code: string; label: string }[] = [
  { code: "high_fico",             label: "High FICO" },
  { code: "strong_reserves",       label: "Strong Reserves" },
  { code: "low_ltv",               label: "Low LTV" },
  { code: "low_dti",               label: "Low DTI" },
  { code: "strong_dscr",           label: "Strong DSCR" },
  { code: "stable_employment",     label: "Stable Employment" },
  { code: "strong_payment_history",label: "Strong Payment History" },
  { code: "significant_liquidity", label: "Significant Liquidity" },
  { code: "strong_property_value", label: "Strong Property Value" },
  { code: "borrower_experience",   label: "Borrower Experience" },
  { code: "low_layered_risk",      label: "Low Layered Risk" },
  { code: "other",                 label: "Other" },
];

const RISK_FACTORS: { code: string; label: string }[] = [
  { code: "high_ltv",                label: "High LTV" },
  { code: "low_fico",                label: "Low FICO" },
  { code: "high_dti",                label: "High DTI" },
  { code: "low_dscr",                label: "Low DSCR" },
  { code: "cash_out",                label: "Cash-Out" },
  { code: "investment_property",     label: "Investment Property" },
  { code: "limited_reserves",        label: "Limited Reserves" },
  { code: "recent_credit_event",     label: "Recent Credit Event" },
  { code: "thin_credit_profile",     label: "Thin Credit Profile" },
  { code: "concentration_risk",      label: "Concentration Risk" },
  { code: "incomplete_documentation",label: "Incomplete Documentation" },
  { code: "pricing_concession",      label: "Pricing Concession" },
  { code: "other",                   label: "Other" },
];

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open:                       "Open",
  draft:                      "Draft",
  submitted:                  "Submitted",
  assigned:                   "Assigned",
  under_review:               "Under Review",
  additional_info_requested:  "Info Requested",
  approved:                   "Approved",
  approved_with_conditions:   "Approved w/ Conditions",
  denied:                     "Denied",
  withdrawn:                  "Withdrawn",
  closed:                     "Closed",
};

const STATUS_CLASS: Record<ExceptionStatus, string> = {
  open:                       "exc-badge--open",
  draft:                      "exc-badge--draft",
  submitted:                  "exc-badge--submitted",
  assigned:                   "exc-badge--submitted",
  under_review:               "exc-badge--submitted",
  additional_info_requested:  "exc-badge--open",
  approved:                   "exc-badge--approved",
  approved_with_conditions:   "exc-badge--approved",
  denied:                     "exc-badge--denied",
  withdrawn:                  "exc-badge--withdrawn",
  closed:                     "exc-badge--closed",
};

const SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

const SEVERITY_CLASS: Record<ExceptionSeverity, string> = {
  low: "exc-sev--low", medium: "exc-sev--medium",
  high: "exc-sev--high", critical: "exc-sev--critical",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((x) => x.value === value)?.label ?? value;
}

// ── FactorSelector ────────────────────────────────────────────────────────────

function FactorSelector({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { code: string; label: string }[];
  selected: ExceptionFactor[];
  onChange: (factors: ExceptionFactor[]) => void;
}) {
  function toggle(code: string) {
    const exists = selected.find((f) => f.code === code);
    if (exists) {
      onChange(selected.filter((f) => f.code !== code));
    } else {
      onChange([...selected, { code, notes: null }]);
    }
  }

  function setNotes(code: string, notes: string) {
    onChange(selected.map((f) => f.code === code ? { ...f, notes: notes || null } : f));
  }

  return (
    <div className="exc-factor-section">
      <p className="exc-factor-section-label">{title}</p>
      <div className="exc-factor-grid">
        {options.map(({ code, label }) => {
          const item = selected.find((f) => f.code === code);
          const checked = !!item;
          return (
            <div key={code} className="exc-factor-item">
              <label className="exc-factor-check-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(code)}
                  className="exc-factor-checkbox"
                />
                <span className="exc-factor-label-text">{label}</span>
              </label>
              {checked && (
                <input
                  className="exc-factor-notes-input"
                  placeholder="Notes (optional)"
                  value={item?.notes ?? ""}
                  onChange={(e) => setNotes(code, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FormState ─────────────────────────────────────────────────────────────────

type FormState = {
  primary_category: string;
  exception_type: string;
  reason_code: string;
  title: string;
  severity: ExceptionSeverity;
  // Display text (human-readable)
  guideline_value: string;
  actual_value: string;
  // Structured metrics
  metric_type: string;
  guideline_operator: string;
  metric_guideline: string;
  metric_actual: string;
  metric_variance: string;
  metric_variance_unit: string;
  // Justification
  justification: string;
  description: string;
  // Structured factors
  compensating_factors: ExceptionFactor[];
  risk_factors: ExceptionFactor[];
};

const emptyForm = (): FormState => ({
  primary_category:   "other",
  exception_type:     "ltv",
  reason_code:        "other",
  title:              "",
  severity:           "medium",
  guideline_value:    "",
  actual_value:       "",
  metric_type:        "",
  guideline_operator: "<=",
  metric_guideline:   "",
  metric_actual:      "",
  metric_variance:    "",
  metric_variance_unit: "pct",
  justification:      "",
  description:        "",
  compensating_factors: [],
  risk_factors:         [],
});

// ── ExceptionForm ─────────────────────────────────────────────────────────────

function ExceptionForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const hasMetrics = !!form.metric_type;

  return (
    <div className="exc-form-panel">
      <h4 className="exc-form-title">New Exception Request</h4>

      {/* Classification row */}
      <div className="exc-form-grid exc-form-grid--3">
        <label className="exc-label">
          Primary Category <span className="exc-required">*</span>
          <select className="exc-select" value={form.primary_category} onChange={(e) => set("primary_category", e.target.value)}>
            {PRIMARY_CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="exc-label">
          Exception Type <span className="exc-required">*</span>
          <select className="exc-select" value={form.exception_type} onChange={(e) => set("exception_type", e.target.value)}>
            {EXCEPTION_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="exc-label">
          Reason Code <span className="exc-required">*</span>
          <select className="exc-select" value={form.reason_code} onChange={(e) => set("reason_code", e.target.value)}>
            {REASON_CODES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Title + Severity */}
      <div className="exc-form-grid">
        <label className="exc-label">
          Title <span className="exc-required">*</span>
          <input
            className="exc-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Brief summary of the exception requested"
          />
        </label>
        <label className="exc-label">
          Severity
          <select className="exc-select" value={form.severity} onChange={(e) => set("severity", e.target.value as ExceptionSeverity)}>
            {(["low", "medium", "high", "critical"] as ExceptionSeverity[]).map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Metric section */}
      <div className="exc-metric-section">
        <p className="exc-section-label">Measurement</p>
        <div className="exc-form-grid exc-form-grid--3">
          <label className="exc-label">
            Metric Type
            <select className="exc-select" value={form.metric_type} onChange={(e) => set("metric_type", e.target.value)}>
              <option value="">— None —</option>
              {METRIC_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="exc-label">
            Guideline (display)
            <input className="exc-input" value={form.guideline_value} onChange={(e) => set("guideline_value", e.target.value)} placeholder="e.g. 75%" />
          </label>
          <label className="exc-label">
            Actual (display)
            <input className="exc-input" value={form.actual_value} onChange={(e) => set("actual_value", e.target.value)} placeholder="e.g. 78.5%" />
          </label>
        </div>
        {hasMetrics && (
          <div className="exc-form-grid exc-form-grid--4">
            <label className="exc-label">
              Operator
              <select className="exc-select" value={form.guideline_operator} onChange={(e) => set("guideline_operator", e.target.value)}>
                {["<=", ">=", "<", ">", "="].map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </label>
            <label className="exc-label">
              Guideline Value
              <input type="number" step="0.01" className="exc-input" value={form.metric_guideline} onChange={(e) => set("metric_guideline", e.target.value)} placeholder="75" />
            </label>
            <label className="exc-label">
              Actual Value
              <input type="number" step="0.01" className="exc-input" value={form.metric_actual} onChange={(e) => set("metric_actual", e.target.value)} placeholder="78.5" />
            </label>
            <label className="exc-label">
              Unit
              <select className="exc-select" value={form.metric_variance_unit} onChange={(e) => set("metric_variance_unit", e.target.value)}>
                {VARIANCE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Justification */}
      <label className="exc-label">
        Justification <span className="exc-required">*</span>
        <textarea
          className="exc-textarea"
          rows={3}
          value={form.justification}
          onChange={(e) => set("justification", e.target.value)}
          placeholder="Business reason for this exception. Include relevant context from the borrower profile or loan scenario."
        />
      </label>

      {/* Factors */}
      <FactorSelector
        title="Compensating Factors"
        options={COMPENSATING_FACTORS}
        selected={form.compensating_factors}
        onChange={(v) => set("compensating_factors", v)}
      />
      <FactorSelector
        title="Risk Factors"
        options={RISK_FACTORS}
        selected={form.risk_factors}
        onChange={(v) => set("risk_factors", v)}
      />

      {/* Internal notes */}
      <label className="exc-label">
        Internal Notes
        <textarea
          className="exc-textarea"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional — processor or underwriter internal notes"
        />
      </label>

      <div className="exc-form-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button
          className="primary-button"
          type="button"
          disabled={saving || !form.title.trim() || !form.justification.trim()}
          onClick={() => void onSave(form)}
        >
          {saving ? "Submitting…" : "Submit Exception"}
        </button>
      </div>
    </div>
  );
}

// ── ExceptionCard ─────────────────────────────────────────────────────────────

function FactorChips({ factors, variant }: { factors: ExceptionFactor[]; variant: "comp" | "risk" }) {
  if (factors.length === 0) return null;
  const cls = variant === "comp" ? "exc-factor-chip--comp" : "exc-factor-chip--risk";
  const options = variant === "comp" ? COMPENSATING_FACTORS : RISK_FACTORS;
  return (
    <div className="exc-factor-chips">
      {factors.map((f) => (
        <span key={f.code} className={`exc-factor-chip ${cls}`} title={f.notes ?? undefined}>
          {options.find((o) => o.code === f.code)?.label ?? f.code}
        </span>
      ))}
    </div>
  );
}

function ExceptionCard({ exc, token, onRefresh }: { exc: ExceptionOut; token: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "deny" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "deny" | "withdraw") {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/${exc.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Action failed (${res.status})`);
      }
      setDeciding(null);
      setReason("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const isActionable = ["open", "submitted", "under_review", "additional_info_requested"].includes(exc.status);
  const categoryLabel = PRIMARY_CATEGORIES.find((c) => c.value === exc.primary_category)?.label ?? exc.primary_category;
  const reasonLabel = REASON_CODES.find((r) => r.value === exc.reason_code)?.label ?? exc.reason_code;
  const typeLabel = EXCEPTION_TYPES.find((t) => t.value === exc.exception_type)?.label ?? exc.exception_type;

  return (
    <div className="exc-card">
      <div
        className="exc-card-header"
        onClick={() => setExpanded((e) => !e)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((x) => !x); }}
      >
        <div className="exc-card-meta">
          <span className={`exc-badge ${STATUS_CLASS[exc.status]}`}>{STATUS_LABELS[exc.status]}</span>
          <span className={`exc-sev ${SEVERITY_CLASS[exc.severity]}`}>{SEVERITY_LABELS[exc.severity]}</span>
          <span className="exc-category-chip">{categoryLabel}</span>
          <span className="exc-type-tag">{typeLabel}</span>
        </div>
        <div className="exc-card-title-row">
          <strong className="exc-card-title">{exc.title}</strong>
          <span className="exc-card-date">{formatDate(exc.created_at)}</span>
        </div>
      </div>

      {expanded && (
        <div className="exc-card-body">
          {/* Reason code */}
          {exc.reason_code && exc.reason_code !== "other" && (
            <p className="exc-reason-code">Reason: {reasonLabel}</p>
          )}

          {/* Structured metric comparison */}
          {(exc.metric_guideline != null || exc.metric_actual != null || exc.guideline_value || exc.actual_value) && (
            <div className="exc-comparison-row">
              <div className="exc-comparison-cell">
                <span>Guideline</span>
                <strong>
                  {exc.metric_guideline != null
                    ? `${exc.guideline_operator ?? ""} ${exc.metric_guideline}${exc.metric_variance_unit === "pct" ? "%" : exc.metric_variance_unit ? ` ${exc.metric_variance_unit}` : ""}`
                    : exc.guideline_value ?? "—"}
                </strong>
              </div>
              <div className="exc-comparison-cell">
                <span>Actual</span>
                <strong>
                  {exc.metric_actual != null
                    ? `${exc.metric_actual}${exc.metric_variance_unit === "pct" ? "%" : exc.metric_variance_unit ? ` ${exc.metric_variance_unit}` : ""}`
                    : exc.actual_value ?? "—"}
                </strong>
              </div>
              {(exc.metric_variance != null || exc.variance) && (
                <div className="exc-comparison-cell exc-comparison-cell--variance">
                  <span>Variance</span>
                  <strong>
                    {exc.metric_variance != null
                      ? `${exc.metric_variance > 0 ? "+" : ""}${exc.metric_variance}${exc.metric_variance_unit === "pct" ? "%" : exc.metric_variance_unit ? ` ${exc.metric_variance_unit}` : ""}`
                      : exc.variance ?? "—"}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Justification */}
          {exc.justification && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Justification</p>
              <p className="exc-detail-text">{exc.justification}</p>
            </div>
          )}

          {/* Structured factors */}
          {exc.compensating_factors.length > 0 && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Compensating Factors</p>
              <FactorChips factors={exc.compensating_factors} variant="comp" />
            </div>
          )}
          {exc.risk_factors.length > 0 && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Risk Factors</p>
              <FactorChips factors={exc.risk_factors} variant="risk" />
            </div>
          )}

          {exc.description && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Notes</p>
              <p className="exc-detail-text">{exc.description}</p>
            </div>
          )}
          {exc.decided_at && (
            <p className="exc-decided-at">Decision recorded {formatDate(exc.decided_at)}</p>
          )}

          {isActionable && !deciding && (
            <div className="exc-decision-row">
              <button className="exc-btn-approve"  type="button" onClick={() => setDeciding("approve")}>Approve</button>
              <button className="exc-btn-deny"     type="button" onClick={() => setDeciding("deny")}>Deny</button>
              <button className="exc-btn-withdraw" type="button" onClick={() => setDeciding("withdraw")}>Withdraw</button>
            </div>
          )}

          {deciding && (
            <div className="exc-confirm-panel">
              <p className="exc-confirm-label">
                {deciding === "approve" ? "Approve" : deciding === "deny" ? "Deny" : "Withdraw"} — add a reason (optional)
              </p>
              <textarea
                className="exc-textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for decision…"
              />
              {error && <p className="exc-error">{error}</p>}
              <div className="exc-confirm-actions">
                <button className="ghost-button" type="button" onClick={() => { setDeciding(null); setReason(""); setError(null); }}>Cancel</button>
                <button
                  className={deciding === "approve" ? "exc-btn-approve" : "exc-btn-deny"}
                  type="button"
                  onClick={() => void decide(deciding)}
                >
                  Confirm {deciding === "approve" ? "Approval" : deciding === "deny" ? "Denial" : "Withdrawal"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── WorkspaceExceptions ───────────────────────────────────────────────────────

export function WorkspaceExceptions({ loan }: Props) {
  const { token } = useAuth();
  const [exceptions, setExceptions] = useState<ExceptionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | "all">("all");

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/?loan_id=${loan.id}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setExceptions(await res.json() as ExceptionOut[]);
    } catch {
      setError("Could not load exceptions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [loan.id, token]);

  async function handleCreate(form: FormState) {
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        exception_type:    form.exception_type,
        title:             form.title,
        description:       form.description || null,
        severity:          form.severity,
        primary_category:  form.primary_category,
        reason_code:       form.reason_code,
        guideline_value:   form.guideline_value || null,
        actual_value:      form.actual_value || null,
        justification:     form.justification || null,
        metric_type:       form.metric_type || null,
        guideline_operator:form.guideline_operator || null,
        metric_guideline:  form.metric_guideline ? parseFloat(form.metric_guideline) : null,
        metric_actual:     form.metric_actual ? parseFloat(form.metric_actual) : null,
        metric_variance:   form.metric_variance ? parseFloat(form.metric_variance) : null,
        metric_variance_unit: form.metric_variance_unit || null,
        compensating_factors: form.compensating_factors,
        risk_factors:      form.risk_factors,
        loan_id:           loan.id,
        context_type:      "loan_file",
        exception_source:  "loan_file",
      };
      const res = await fetch(`${API_BASE}/exceptions/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Failed to create exception");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = filterStatus === "all"
    ? exceptions
    : exceptions.filter((e) => e.status === filterStatus);

  const counts: Record<string, number> = {};
  for (const e of exceptions) {
    counts[e.status] = (counts[e.status] ?? 0) + 1;
  }

  const filterTabs: Array<ExceptionStatus | "all"> = [
    "all", "open", "submitted", "under_review", "approved", "denied", "withdrawn",
  ];

  return (
    <section className="exc-workspace fade-slide-in">
      <div className="exc-header">
        <div>
          <h2 className="ws-section-title">Exceptions</h2>
          <p className="ws-section-subtitle">
            Underwriting and guideline exceptions for this loan file
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New Exception"}
        </button>
      </div>

      {showForm && (
        <ExceptionForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={saving} />
      )}

      <div className="exc-filter-tabs">
        {filterTabs.map((s) => (
          <button
            key={s}
            type="button"
            className={`exc-filter-tab ${filterStatus === s ? "exc-filter-tab--active" : ""}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "All" : STATUS_LABELS[s as ExceptionStatus]}
            {s !== "all" && counts[s] != null ? <span className="exc-filter-count">{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {loading && <p className="ws-status-loading">Loading exceptions…</p>}
      {error && <p className="ws-status-error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="exc-empty">
          <p>
            {filterStatus === "all"
              ? "No exceptions on this loan."
              : `No ${STATUS_LABELS[filterStatus as ExceptionStatus].toLowerCase()} exceptions.`}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="exc-list">
          {filtered.map((exc) => (
            <ExceptionCard key={exc.id} exc={exc} token={token ?? ""} onRefresh={() => void load()} />
          ))}
        </div>
      )}
    </section>
  );
}
