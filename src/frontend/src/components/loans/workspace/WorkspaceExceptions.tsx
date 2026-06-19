import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import type { ExceptionDecisionConditionOut, ExceptionFactor, ExceptionOut, ExceptionSeverity, ExceptionStatus } from "@/types/api";
import type { LoanSummary } from "@/types/loan";
import {
  PRIMARY_CATEGORIES,
  EXCEPTION_TYPES,
  REASON_CODES,
  METRIC_TYPES,
  VARIANCE_UNITS,
  COMPENSATING_FACTORS,
  RISK_FACTORS,
  STATUS_LABELS,
  STATUS_CLASS,
  SEVERITY_LABELS,
  SEVERITY_CLASS,
  formatExcDate,
} from "@/lib/exceptionConstants";

type Props = { loan: LoanSummary };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type DecisionType = "as_requested" | "with_conditions" | "denied" | "information_requested";

const DECISION_TYPE_OPTIONS: { value: DecisionType; label: string }[] = [
  { value: "as_requested",          label: "Approve as Requested" },
  { value: "with_conditions",       label: "Approve with Conditions" },
  { value: "denied",                label: "Deny" },
  { value: "information_requested", label: "Request More Info" },
];

const DECISION_CONDITION_CATEGORIES: { value: string; label: string }[] = [
  { value: "pricing",       label: "Pricing" },
  { value: "escrow",        label: "Escrow" },
  { value: "collateral",    label: "Collateral" },
  { value: "credit",        label: "Credit" },
  { value: "documentation", label: "Documentation" },
  { value: "funding",       label: "Funding" },
  { value: "compliance",    label: "Compliance" },
  { value: "other",         label: "Other" },
];

type ConditionDraft = {
  condition_category: string;
  action: string;
  imposed_value: string;
  is_required: boolean;
};

function emptyCondition(): ConditionDraft {
  return { condition_category: "other", action: "", imposed_value: "", is_required: true };
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

// ── DecideForm ────────────────────────────────────────────────────────────────

function DecideForm({
  excId,
  token,
  onComplete,
  onCancel,
}: {
  excId: string;
  token: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [decisionType, setDecisionType] = useState<DecisionType>("as_requested");
  const [rationale, setRationale] = useState("");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCondition() {
    setConditions((cs) => [...cs, emptyCondition()]);
  }
  function removeCondition(idx: number) {
    setConditions((cs) => cs.filter((_, i) => i !== idx));
  }
  function updateCondition(idx: number, field: keyof ConditionDraft, value: string | boolean) {
    setConditions((cs) => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  const isApproval = decisionType === "as_requested" || decisionType === "with_conditions";
  const canSubmit = !saving && (isApproval || rationale.trim().length > 0);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        decision_type: decisionType,
        rationale: rationale || null,
        conditions: decisionType === "with_conditions"
          ? conditions.map((c) => {
              const numeric = parseFloat(c.imposed_value);
              return {
                condition_category: c.condition_category,
                action: c.action,
                imposed_value: c.imposed_value || null,
                imposed_value_numeric: !isNaN(numeric) ? numeric : null,
                is_required: c.is_required,
              };
            })
          : [],
      };
      const res = await fetch(`${API_BASE}/exceptions/${excId}/decide`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Failed (${res.status})`);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="exc-decide-form">
      <p className="exc-form-title">Record Decision</p>

      <div className="exc-decide-type-row">
        {DECISION_TYPE_OPTIONS.map(({ value, label }) => (
          <label
            key={value}
            className={`exc-decide-type-option${decisionType === value ? " exc-decide-type-option--active" : ""}`}
          >
            <input
              type="radio"
              name={`decision_type_${excId}`}
              value={value}
              checked={decisionType === value}
              onChange={() => { setDecisionType(value); setConditions([]); }}
              style={{ display: "none" }}
            />
            {label}
          </label>
        ))}
      </div>

      <label className="exc-label">
        Rationale
        {!isApproval && <span className="exc-required"> *</span>}
        <textarea
          className="exc-textarea"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder={isApproval ? "Optional approval notes…" : "Explain the decision…"}
        />
      </label>

      {decisionType === "with_conditions" && (
        <div className="exc-conditions-builder">
          <div className="exc-conditions-builder-header">
            <p className="exc-section-label">Imposed Conditions</p>
            <button className="exc-btn-add-condition" type="button" onClick={addCondition}>
              + Add Condition
            </button>
          </div>
          {conditions.length === 0 && (
            <p className="exc-conditions-empty">
              No conditions added. Click &quot;+ Add Condition&quot; to impose requirements.
            </p>
          )}
          {conditions.map((c, idx) => (
            <div key={idx} className="exc-condition-row">
              <div className="exc-condition-row-fields">
                <select
                  className="exc-select"
                  value={c.condition_category}
                  onChange={(e) => updateCondition(idx, "condition_category", e.target.value)}
                >
                  {DECISION_CONDITION_CATEGORIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <input
                  className="exc-input"
                  placeholder="Action required…"
                  value={c.action}
                  onChange={(e) => updateCondition(idx, "action", e.target.value)}
                />
                <input
                  className="exc-input"
                  placeholder="Required value (optional)"
                  value={c.imposed_value}
                  onChange={(e) => updateCondition(idx, "imposed_value", e.target.value)}
                />
                <label className="exc-condition-req-label">
                  <input
                    type="checkbox"
                    checked={c.is_required}
                    onChange={(e) => updateCondition(idx, "is_required", e.target.checked)}
                  />
                  Required
                </label>
              </div>
              <button
                className="exc-btn-remove-condition"
                type="button"
                onClick={() => removeCondition(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="exc-error">{error}</p>}

      <div className="exc-confirm-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button
          className={isApproval ? "exc-btn-approve" : "exc-btn-deny"}
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {saving ? "Saving…" : "Confirm Decision"}
        </button>
      </div>
    </div>
  );
}

// ── SummaryStats ──────────────────────────────────────────────────────────────

function SummaryStats({ exceptions }: { exceptions: ExceptionOut[] }) {
  if (exceptions.length === 0) return null;

  const pending = exceptions.filter((e) =>
    ["open", "draft", "submitted", "assigned", "under_review", "additional_info_requested"].includes(e.status)
  ).length;
  const approved = exceptions.filter((e) =>
    e.status === "approved" || e.status === "approved_with_conditions"
  ).length;
  const denied = exceptions.filter((e) => e.status === "denied").length;
  const critical = exceptions.filter((e) => e.severity === "critical").length;

  return (
    <div className="exc-summary-stats">
      <div className="exc-stat-item">
        <span className="exc-stat-count">{exceptions.length}</span>
        <span className="exc-stat-label">Total</span>
      </div>
      <div className="exc-stat-divider" />
      <div className="exc-stat-item">
        <span className="exc-stat-count exc-stat-count--warning">{pending}</span>
        <span className="exc-stat-label">Pending</span>
      </div>
      <div className="exc-stat-item">
        <span className="exc-stat-count exc-stat-count--success">{approved}</span>
        <span className="exc-stat-label">Approved</span>
      </div>
      <div className="exc-stat-item">
        <span className="exc-stat-count exc-stat-count--danger">{denied}</span>
        <span className="exc-stat-label">Denied</span>
      </div>
      {critical > 0 && (
        <div className="exc-stat-item">
          <span className="exc-stat-count exc-stat-count--critical">{critical}</span>
          <span className="exc-stat-label">Critical</span>
        </div>
      )}
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

// ── ConditionList ─────────────────────────────────────────────────────────────

const COND_STATUS_LABEL: Record<string, string> = {
  pending: "Pending", satisfied: "Satisfied", waived: "Waived", expired: "Expired",
};

const COND_CAT_LABEL: Record<string, string> = {
  pricing: "Pricing", escrow: "Escrow", collateral: "Collateral",
  credit: "Credit", documentation: "Documentation", funding: "Funding",
  compliance: "Compliance", other: "Other",
};

function ConditionList({ excId, token }: { excId: string; token: string }) {
  const [conditions, setConditions] = useState<ExceptionDecisionConditionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/exceptions/${excId}/conditions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConditions(await res.json() as ExceptionDecisionConditionOut[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [excId, token]);

  async function act(condId: string, type: "satisfy" | "waive") {
    setActioning(condId);
    setActionError(null);
    try {
      const res = await fetch(
        `${API_BASE}/exceptions/${excId}/conditions/${condId}/${type}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? "Action failed");
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  if (loading) return <p className="exc-conditions-loading">Checking conditions…</p>;
  if (conditions.length === 0) return null;

  const pendingRequired = conditions.filter((c) => c.status === "pending" && c.is_required).length;

  return (
    <div className="exc-conditions-list">
      <div className="exc-conditions-list-header">
        <p className="exc-detail-label">Imposed Conditions</p>
        {pendingRequired > 0 && (
          <span className="exc-conditions-pending-badge">{pendingRequired} required pending</span>
        )}
        {pendingRequired === 0 && conditions.length > 0 && (
          <span className="exc-conditions-clear-badge">All clear</span>
        )}
      </div>
      {actionError && <p className="exc-error">{actionError}</p>}
      {conditions.map((c) => (
        <div key={c.id} className={`exc-condition-item exc-condition-item--${c.status}`}>
          <div className="exc-condition-item-top">
            <span className="exc-cond-cat-badge">{COND_CAT_LABEL[c.condition_category] ?? c.condition_category}</span>
            <span className={`exc-cond-status-badge exc-cond-status--${c.status}`}>
              {COND_STATUS_LABEL[c.status] ?? c.status}
            </span>
            {c.is_required && c.status === "pending" && (
              <span className="exc-cond-required-tag">Required</span>
            )}
          </div>
          <p className="exc-condition-action-text">{c.action}</p>
          {c.imposed_value && (
            <p className="exc-cond-imposed-value">
              Target: <strong>{c.imposed_value}</strong>
            </p>
          )}
          {c.status === "pending" && (
            <div className="exc-cond-actions">
              <button
                className="exc-btn-satisfy"
                type="button"
                disabled={actioning === c.id}
                onClick={() => void act(c.id, "satisfy")}
              >
                {actioning === c.id ? "…" : "Mark Satisfied"}
              </button>
              <button
                className="exc-btn-waive-cond"
                type="button"
                disabled={actioning === c.id}
                onClick={() => void act(c.id, "waive")}
              >
                Waive
              </button>
            </div>
          )}
          {(c.status === "satisfied" || c.status === "waived") && c.satisfaction_date && (
            <p className="exc-cond-resolved-date">
              {COND_STATUS_LABEL[c.status]} {formatExcDate(c.satisfaction_date)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ExceptionCard({ exc, token, onRefresh }: { exc: ExceptionOut; token: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deciding, setDeciding] = useState<"decide" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/${exc.id}/withdraw`, {
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

  const isActionable = ["open", "submitted", "assigned", "under_review", "additional_info_requested"].includes(exc.status);
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
          <span className="exc-card-date">{formatExcDate(exc.created_at)}</span>
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
            <p className="exc-decided-at">Decision recorded {formatExcDate(exc.decided_at)}</p>
          )}

          {exc.status === "approved_with_conditions" && (
            <ConditionList excId={exc.id} token={token} />
          )}

          {isActionable && !deciding && (
            <div className="exc-decision-row">
              <button className="exc-btn-decide" type="button" onClick={() => setDeciding("decide")}>
                Make Decision
              </button>
              <button className="exc-btn-withdraw" type="button" onClick={() => setDeciding("withdraw")}>
                Withdraw
              </button>
            </div>
          )}

          {deciding === "decide" && (
            <DecideForm
              excId={exc.id}
              token={token}
              onComplete={() => { setDeciding(null); onRefresh(); }}
              onCancel={() => setDeciding(null)}
            />
          )}

          {deciding === "withdraw" && (
            <div className="exc-confirm-panel">
              <p className="exc-confirm-label">Withdraw — add a reason (optional)</p>
              <textarea
                className="exc-textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for withdrawal…"
              />
              {error && <p className="exc-error">{error}</p>}
              <div className="exc-confirm-actions">
                <button className="ghost-button" type="button" onClick={() => { setDeciding(null); setReason(""); setError(null); }}>Cancel</button>
                <button className="exc-btn-withdraw" type="button" onClick={() => void withdraw()}>
                  Confirm Withdrawal
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

      <SummaryStats exceptions={exceptions} />

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
