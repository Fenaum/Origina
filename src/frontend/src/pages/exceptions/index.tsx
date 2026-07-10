import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { useAuth } from "@/state/auth";
import type {
  ExceptionFactor,
  ExceptionOut,
  ExceptionSeverity,
  ExceptionStatus,
  PaginatedResponse,
} from "@/types/api";
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  primary_category: string;
  exception_type: string;
  reason_code: string;
  title: string;
  severity: ExceptionSeverity;
  guideline_value: string;
  actual_value: string;
  metric_type: string;
  guideline_operator: string;
  metric_guideline: string;
  metric_actual: string;
  metric_variance: string;
  metric_variance_unit: string;
  justification: string;
  description: string;
  compensating_factors: ExceptionFactor[];
  risk_factors: ExceptionFactor[];
};

function emptyForm(): FormState {
  return {
    primary_category:     "other",
    exception_type:       "ltv",
    reason_code:          "other",
    title:                "",
    severity:             "medium",
    guideline_value:      "",
    actual_value:         "",
    metric_type:          "",
    guideline_operator:   "<=",
    metric_guideline:     "",
    metric_actual:        "",
    metric_variance:      "",
    metric_variance_unit: "pct",
    justification:        "",
    description:          "",
    compensating_factors: [],
    risk_factors:         [],
  };
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

// ── PreFileExceptionForm ──────────────────────────────────────────────────────

function PreFileExceptionForm({
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
      <h4 className="exc-form-title">New Pre-File Exception Request</h4>
      <p className="exc-form-subtitle muted">
        Exceptions submitted here are not tied to a loan yet. Once approved, you can attach
        them to a loan during the submission review step.
      </p>

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

      <label className="exc-label">
        Internal Notes
        <textarea
          className="exc-textarea"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional — additional context or notes"
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

// ── PreFileExceptionCard ──────────────────────────────────────────────────────

function PreFileExceptionCard({
  exc,
  token,
  onRefresh,
}: {
  exc: ExceptionOut;
  token: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState<"submit" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = PRIMARY_CATEGORIES.find((c) => c.value === exc.primary_category)?.label ?? exc.primary_category;
  const typeLabel = EXCEPTION_TYPES.find((t) => t.value === exc.exception_type)?.label ?? exc.exception_type;
  const reasonLabel = REASON_CODES.find((r) => r.value === exc.reason_code)?.label ?? exc.reason_code;

  const isDraft = exc.status === "open" || exc.status === "draft";
  const isSubmitted = ["submitted", "assigned", "under_review", "additional_info_requested"].includes(exc.status);
  const isTerminal = ["approved", "approved_with_conditions", "denied", "withdrawn", "closed"].includes(exc.status);

  async function submit() {
    setActioning("submit");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/${exc.id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Failed (${res.status})`);
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  async function withdraw() {
    setActioning("withdraw");
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/exceptions/${exc.id}/withdraw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Failed (${res.status})`);
      }
      setConfirmWithdraw(false);
      setReason("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="exc-card">
      <div
        className="exc-card-header"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
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
          {exc.reason_code && exc.reason_code !== "other" && (
            <p className="exc-reason-code">Reason: {reasonLabel}</p>
          )}

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
            </div>
          )}

          {exc.justification && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Justification</p>
              <p className="exc-detail-text">{exc.justification}</p>
            </div>
          )}

          {exc.decided_at && (
            <p className="exc-decided-at">Decision recorded {formatExcDate(exc.decided_at)}</p>
          )}

          {exc.status === "approved" && (
            <p className="preexc-approved-note">
              This exception is approved. You can attach it to a loan during the submission review step.
            </p>
          )}

          {exc.status === "approved_with_conditions" && (
            <p className="preexc-approved-note preexc-approved-note--cond">
              Approved with conditions. Attach to a loan file and satisfy imposed conditions before funding.
            </p>
          )}

          {error && <p className="exc-error">{error}</p>}

          {isDraft && !confirmWithdraw && (
            <div className="exc-decision-row">
              <button
                className="primary-button"
                type="button"
                disabled={actioning === "submit"}
                onClick={() => void submit()}
              >
                {actioning === "submit" ? "Submitting…" : "Submit for Review"}
              </button>
              <button
                className="exc-btn-withdraw"
                type="button"
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </button>
            </div>
          )}

          {isSubmitted && !confirmWithdraw && (
            <div className="exc-decision-row">
              <span className="preexc-pending-label">Under review by underwriting</span>
              <button
                className="exc-btn-withdraw"
                type="button"
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </button>
            </div>
          )}

          {confirmWithdraw && (
            <div className="exc-confirm-panel">
              <p className="exc-confirm-label">Withdraw — add a reason (optional)</p>
              <textarea
                className="exc-textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for withdrawal…"
              />
              <div className="exc-confirm-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => { setConfirmWithdraw(false); setReason(""); setError(null); }}
                >
                  Cancel
                </button>
                <button
                  className="exc-btn-withdraw"
                  type="button"
                  disabled={actioning === "withdraw"}
                  onClick={() => void withdraw()}
                >
                  {actioning === "withdraw" ? "Withdrawing…" : "Confirm Withdrawal"}
                </button>
              </div>
            </div>
          )}

          {isTerminal && !["approved", "approved_with_conditions"].includes(exc.status) && (
            <p className="preexc-terminal-note">
              {exc.status === "denied" ? "This exception was denied." : "This exception has been withdrawn."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTER_TABS: Array<ExceptionStatus | "all"> = [
  "all", "draft", "submitted", "under_review", "approved", "denied", "withdrawn",
];

export default function PreFileExceptionsPage() {
  const { token } = useAuth();
  const [exceptions, setExceptions] = useState<ExceptionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | "all">("all");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/exceptions/?exception_source=pre_file&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      // Backend returns the pagination envelope {items, total} — unwrap to the
      // flat array the rest of this component expects.
      const envelope = (await res.json()) as PaginatedResponse<ExceptionOut>;
      setExceptions(envelope.items ?? []);
    } catch {
      setError("Could not load exceptions.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(form: FormState) {
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        exception_type:       form.exception_type,
        title:                form.title,
        description:          form.description || null,
        severity:             form.severity,
        primary_category:     form.primary_category,
        reason_code:          form.reason_code,
        guideline_value:      form.guideline_value || null,
        actual_value:         form.actual_value || null,
        justification:        form.justification || null,
        metric_type:          form.metric_type || null,
        guideline_operator:   form.guideline_operator || null,
        metric_guideline:     form.metric_guideline ? parseFloat(form.metric_guideline) : null,
        metric_actual:        form.metric_actual ? parseFloat(form.metric_actual) : null,
        metric_variance:      form.metric_variance ? parseFloat(form.metric_variance) : null,
        metric_variance_unit: form.metric_variance_unit || null,
        compensating_factors: form.compensating_factors,
        risk_factors:         form.risk_factors,
        loan_id:              null,
        context_type:         "pre_file",
        exception_source:     "pre_file",
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

  const approvedCount = (counts["approved"] ?? 0) + (counts["approved_with_conditions"] ?? 0);

  return (
    <AppLayout allowedRoles={["account_executive", "broker"]}>
      <div className="preexc-page fade-slide-in">
        <div className="preexc-page-header">
          <div>
            <h1 className="preexc-page-title">Pre-File Exceptions</h1>
            <p className="preexc-page-subtitle">
              Request underwriting exceptions before submitting a loan. Approved exceptions
              can be attached to a loan file at submission.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancel" : "+ New Exception"}
          </button>
        </div>

        {approvedCount > 0 && (
          <div className="preexc-approved-banner">
            <strong>{approvedCount}</strong> approved exception{approvedCount !== 1 ? "s" : ""} ready to attach to a loan.
            Add them during the &quot;Review &amp; Submit&quot; step of a new loan submission.
          </div>
        )}

        {showForm && (
          <PreFileExceptionForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {error && <p className="ws-status-error">{error}</p>}

        <div className="exc-filter-tabs">
          {FILTER_TABS.map((s) => (
            <button
              key={s}
              type="button"
              className={`exc-filter-tab ${filterStatus === s ? "exc-filter-tab--active" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as ExceptionStatus]}
              {s !== "all" && counts[s] != null ? (
                <span className="exc-filter-count">{counts[s]}</span>
              ) : null}
            </button>
          ))}
        </div>

        {loading && <p className="ws-status-loading">Loading exceptions…</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="exc-empty">
            <p>
              {filterStatus === "all"
                ? "No pre-file exceptions yet. Click \"+ New Exception\" to get started."
                : `No ${STATUS_LABELS[filterStatus as ExceptionStatus].toLowerCase()} exceptions.`}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="exc-list">
            {filtered.map((exc) => (
              <PreFileExceptionCard
                key={exc.id}
                exc={exc}
                token={token ?? ""}
                onRefresh={() => void load()}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
