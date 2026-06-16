import { useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import type { ExceptionOut, ExceptionSeverity, ExceptionStatus } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const EXCEPTION_TYPES = [
  "ltv",
  "credit_score",
  "dscr",
  "dti",
  "reserve",
  "eligibility",
  "pricing",
  "property",
  "income",
  "documentation",
  "other",
];

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open:      "Open",
  approved:  "Approved",
  denied:    "Denied",
  withdrawn: "Withdrawn",
  closed:    "Closed",
};

const SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

const STATUS_CLASS: Record<ExceptionStatus, string> = {
  open:      "exc-badge--open",
  approved:  "exc-badge--approved",
  denied:    "exc-badge--denied",
  withdrawn: "exc-badge--withdrawn",
  closed:    "exc-badge--closed",
};

const SEVERITY_CLASS: Record<ExceptionSeverity, string> = {
  low:      "exc-sev--low",
  medium:   "exc-sev--medium",
  high:     "exc-sev--high",
  critical: "exc-sev--critical",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type FormState = {
  exception_type: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  guideline_value: string;
  actual_value: string;
  variance: string;
  justification: string;
  compensating_factors: string;
  risk_factors: string;
};

const emptyForm = (): FormState => ({
  exception_type: "ltv",
  title: "",
  description: "",
  severity: "medium",
  guideline_value: "",
  actual_value: "",
  variance: "",
  justification: "",
  compensating_factors: "",
  risk_factors: "",
});

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

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="exc-form-panel">
      <h4 className="exc-form-title">New Exception Request</h4>
      <div className="exc-form-grid">
        <label className="exc-label">
          Type
          <select className="exc-select" value={form.exception_type} onChange={(e) => set("exception_type", e.target.value)}>
            {EXCEPTION_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
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
      <label className="exc-label">
        Title
        <input className="exc-input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief summary of exception requested" />
      </label>
      <div className="exc-form-grid">
        <label className="exc-label">
          Guideline Value
          <input className="exc-input" value={form.guideline_value} onChange={(e) => set("guideline_value", e.target.value)} placeholder="e.g. 75% LTV max" />
        </label>
        <label className="exc-label">
          Actual Value
          <input className="exc-input" value={form.actual_value} onChange={(e) => set("actual_value", e.target.value)} placeholder="e.g. 78.5% LTV" />
        </label>
        <label className="exc-label">
          Variance
          <input className="exc-input" value={form.variance} onChange={(e) => set("variance", e.target.value)} placeholder="e.g. +3.5%" />
        </label>
      </div>
      <label className="exc-label">
        Justification
        <textarea className="exc-textarea" rows={3} value={form.justification} onChange={(e) => set("justification", e.target.value)} placeholder="Business reason for this exception request" />
      </label>
      <label className="exc-label">
        Compensating Factors
        <textarea className="exc-textarea" rows={2} value={form.compensating_factors} onChange={(e) => set("compensating_factors", e.target.value)} placeholder="What mitigates the risk? (low LTV, strong reserves, long employment...)" />
      </label>
      <label className="exc-label">
        Risk Factors
        <textarea className="exc-textarea" rows={2} value={form.risk_factors} onChange={(e) => set("risk_factors", e.target.value)} placeholder="What increases the risk? (optional)" />
      </label>
      <label className="exc-label">
        Description (internal notes)
        <textarea className="exc-textarea" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional internal notes" />
      </label>
      <div className="exc-form-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
        <button
          className="primary-button"
          type="button"
          disabled={saving || !form.title.trim()}
          onClick={() => void onSave(form)}
        >
          {saving ? "Submitting…" : "Submit Exception"}
        </button>
      </div>
    </div>
  );
}

function ExceptionCard({
  exc,
  token,
  onRefresh,
}: {
  exc: ExceptionOut;
  token: string;
  onRefresh: () => void;
}) {
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

  const isOpen = exc.status === "open";

  return (
    <div className="exc-card">
      <div className="exc-card-header" onClick={() => setExpanded((e) => !e)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((x) => !x); }}>
        <div className="exc-card-meta">
          <span className={`exc-badge ${STATUS_CLASS[exc.status]}`}>{STATUS_LABELS[exc.status]}</span>
          <span className={`exc-sev ${SEVERITY_CLASS[exc.severity]}`}>{SEVERITY_LABELS[exc.severity]}</span>
          <span className="exc-type-tag">{exc.exception_type.replace(/_/g, " ").toUpperCase()}</span>
        </div>
        <div className="exc-card-title-row">
          <strong className="exc-card-title">{exc.title}</strong>
          <span className="exc-card-date">{formatDate(exc.created_at)}</span>
        </div>
      </div>

      {expanded && (
        <div className="exc-card-body">
          {(exc.guideline_value || exc.actual_value || exc.variance) && (
            <div className="exc-comparison-row">
              {exc.guideline_value && <div className="exc-comparison-cell"><span>Guideline</span><strong>{exc.guideline_value}</strong></div>}
              {exc.actual_value   && <div className="exc-comparison-cell"><span>Actual</span><strong>{exc.actual_value}</strong></div>}
              {exc.variance       && <div className="exc-comparison-cell exc-comparison-cell--variance"><span>Variance</span><strong>{exc.variance}</strong></div>}
            </div>
          )}
          {exc.justification && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Justification</p>
              <p className="exc-detail-text">{exc.justification}</p>
            </div>
          )}
          {exc.compensating_factors && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Compensating Factors</p>
              <p className="exc-detail-text">{exc.compensating_factors}</p>
            </div>
          )}
          {exc.risk_factors && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Risk Factors</p>
              <p className="exc-detail-text">{exc.risk_factors}</p>
            </div>
          )}
          {exc.description && (
            <div className="exc-detail-block">
              <p className="exc-detail-label">Notes</p>
              <p className="exc-detail-text">{exc.description}</p>
            </div>
          )}
          {exc.decided_at && (
            <p className="exc-decided-at">
              Decision recorded {formatDate(exc.decided_at)}
            </p>
          )}

          {isOpen && !deciding && (
            <div className="exc-decision-row">
              <button className="exc-btn-approve" type="button" onClick={() => setDeciding("approve")}>Approve</button>
              <button className="exc-btn-deny"    type="button" onClick={() => setDeciding("deny")}>Deny</button>
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
      const res = await fetch(`${API_BASE}/exceptions/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          loan_id: loan.id,
          exception_source: "loan_file",
        }),
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
        <ExceptionForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      <div className="exc-filter-tabs">
        {(["all", "open", "approved", "denied", "withdrawn"] as const).map((s) => (
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
          <p>{filterStatus === "all" ? "No exceptions on this loan." : `No ${STATUS_LABELS[filterStatus as ExceptionStatus].toLowerCase()} exceptions.`}</p>
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
