import { useRef, useState } from "react";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useConditions } from "@/hooks/useConditions";
import {
  clearCondition,
  createCondition,
  deleteCondition,
  submitCondition,
  updateCondition,
  waiveCondition,
} from "@/services/conditionsService";
import { useAuth } from "@/state/auth";
import type { ConditionOut, ConditionStage } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type FilterTab = "all" | "open" | "submitted" | "cleared" | "waived" | "rejected";

const STAGE_LABELS: Record<ConditionStage, string> = {
  prior_to_docs:     "PTD",
  prior_to_approval: "PTA",
  prior_to_funding:  "PTF",
};

const STAGE_FULL: Record<ConditionStage, string> = {
  prior_to_docs:     "Prior to Docs",
  prior_to_approval: "Prior to Approval",
  prior_to_funding:  "Prior to Funding",
};

const STATUS_LABELS: Record<string, string> = {
  open:      "Open",
  submitted: "Submitted",
  cleared:   "Cleared",
  waived:    "Waived",
  rejected:  "Rejected",
};

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Add / Edit Form ───────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  stage: ConditionStage;
};

function ConditionForm({
  initial,
  nextNumber,
  onSave,
  onCancel,
  saving,
}: {
  initial?: FormState;
  nextNumber: number;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    initial ?? { name: "", description: "", stage: "prior_to_approval" },
  );

  function set(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  return (
    <div className="cond-form">
      <div className="cond-form-row">
        <label className="cond-form-label">
          Condition Name <span className="cond-form-required">*</span>
        </label>
        <input
          className="cond-form-input"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. 12 months bank statements"
          autoFocus
        />
      </div>
      <div className="cond-form-row">
        <label className="cond-form-label">Description</label>
        <textarea
          className="cond-form-textarea"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Additional details or instructions for the borrower…"
          rows={2}
        />
      </div>
      <div className="cond-form-row">
        <label className="cond-form-label">Stage</label>
        <select
          className="cond-form-select"
          value={form.stage}
          onChange={(e) => set({ stage: e.target.value as ConditionStage })}
        >
          <option value="prior_to_docs">Prior to Docs (PTD)</option>
          <option value="prior_to_approval">Prior to Approval (PTA)</option>
          <option value="prior_to_funding">Prior to Funding (PTF)</option>
        </select>
      </div>
      {!initial && (
        <p className="cond-form-hint">Condition #{nextNumber} will be assigned automatically.</p>
      )}
      <div className="cond-form-actions">
        <button className="cond-btn cond-btn--ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="cond-btn cond-btn--primary"
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Condition"}
        </button>
      </div>
    </div>
  );
}

// ── Waive Dialog ──────────────────────────────────────────────────────────────

function WaiveDialog({
  condition,
  onConfirm,
  onCancel,
  saving,
}: {
  condition: ConditionOut;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="cond-dialog-overlay" onClick={onCancel}>
      <div className="cond-dialog" onClick={(e) => e.stopPropagation()}>
        <h4 className="cond-dialog-title">Waive Condition #{condition.condition_number}</h4>
        <p className="cond-dialog-body">
          <strong>{condition.name}</strong>
          <br />
          Provide a documented reason. Waivers are a legal exception and will appear in compliance reports.
        </p>
        <textarea
          className="cond-form-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for waiver…"
          rows={3}
          autoFocus
        />
        <div className="cond-form-actions">
          <button className="cond-btn cond-btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cond-btn cond-btn--warn"
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={saving || !reason.trim()}
          >
            {saving ? "Waiving…" : "Confirm Waiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single Condition Card ─────────────────────────────────────────────────────

function ConditionCard({
  condition,
  onRefresh,
}: {
  condition: ConditionOut;
  onRefresh: () => void;
}) {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const days = daysAgo(condition.created_at);
  const isResolved = condition.status === "cleared" || condition.status === "waived";

  async function act(fn: () => Promise<unknown>) {
    if (!token || busy) return;
    setBusy(true);
    try { await fn(); onRefresh(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      {waiving && (
        <WaiveDialog
          condition={condition}
          saving={busy}
          onCancel={() => setWaiving(false)}
          onConfirm={(reason) =>
            act(async () => {
              await waiveCondition(condition.id, reason, token!);
              setWaiving(false);
            })
          }
        />
      )}

      <div className={`cond-card cond-card--${condition.status}`}>
        <div className="cond-card-top">
          <div className="cond-card-meta">
            <span className="cond-card-num">#{condition.condition_number}</span>
            <span className={`cond-stage-badge cond-stage--${condition.stage}`} title={STAGE_FULL[condition.stage]}>
              {STAGE_LABELS[condition.stage]}
            </span>
            <span className={`cond-status-pill cond-status--${condition.status}`}>
              {STATUS_LABELS[condition.status]}
            </span>
            {!isResolved && (
              <span className={`cond-age${days >= 14 ? " cond-age--warn" : ""}`}>
                {days === 0 ? "Today" : `${days}d`}
              </span>
            )}
          </div>

          {!isResolved && !editing && (
            <div className="cond-card-actions">
              {condition.status === "open" && (
                <button
                  className="cond-btn cond-btn--xs cond-btn--outline"
                  onClick={() => act(() => submitCondition(condition.id, token!))}
                  disabled={busy}
                  title="Mark as Submitted"
                >
                  Mark Submitted
                </button>
              )}
              {(condition.status === "open" || condition.status === "submitted") && (
                <>
                  <button
                    className="cond-btn cond-btn--xs cond-btn--success"
                    onClick={() => act(() => clearCondition(condition.id, token!))}
                    disabled={busy}
                    title="Clear this condition"
                  >
                    Clear
                  </button>
                  <button
                    className="cond-btn cond-btn--xs cond-btn--warn"
                    onClick={() => setWaiving(true)}
                    disabled={busy}
                    title="Waive this condition"
                  >
                    Waive
                  </button>
                </>
              )}
              <button
                className="cond-btn cond-btn--xs cond-btn--ghost"
                onClick={() => setEditing(true)}
                title="Edit condition"
              >
                Edit
              </button>
              <button
                className="cond-btn cond-btn--xs cond-btn--danger-ghost"
                onClick={() => {
                  if (confirm("Delete this condition?")) {
                    void act(() => deleteCondition(condition.id, token!));
                  }
                }}
                disabled={busy}
                title="Delete condition"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <ConditionForm
            initial={{ name: condition.name, description: condition.description ?? "", stage: condition.stage }}
            nextNumber={condition.condition_number}
            saving={busy}
            onCancel={() => setEditing(false)}
            onSave={(f) =>
              act(async () => {
                await updateCondition(condition.id, { name: f.name, description: f.description, stage: f.stage }, token!);
                setEditing(false);
              })
            }
          />
        ) : (
          <div className="cond-card-body">
            <p className="cond-card-name">{condition.name}</p>
            {condition.description && (
              <p className="cond-card-desc">{condition.description}</p>
            )}
          </div>
        )}

        {/* Resolution info */}
        {condition.status === "cleared" && condition.cleared_at && (
          <div className="cond-card-resolved cond-card-resolved--cleared">
            <span>✓ Cleared</span>
            <span>{formatDate(condition.cleared_at)}</span>
          </div>
        )}
        {condition.status === "waived" && condition.waived_at && (
          <div className="cond-card-resolved cond-card-resolved--waived">
            <span>↩ Waived · {formatDate(condition.waived_at)}</span>
            {condition.waive_reason && (
              <span className="cond-waive-reason">&ldquo;{condition.waive_reason}&rdquo;</span>
            )}
          </div>
        )}

        {/* Document attachment (mock — S3 wired in a future milestone) */}
        {!isResolved && (
          <div className="cond-card-docs">
            <input
              ref={fileRef}
              type="file"
              className="cond-file-input"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setDocName(f.name);
              }}
            />
            {docName ? (
              <div className="cond-doc-attached">
                <span className="cond-doc-icon">📎</span>
                <span className="cond-doc-name">{docName}</span>
                <button
                  className="cond-doc-remove"
                  onClick={() => { setDocName(null); if (fileRef.current) fileRef.current.value = ""; }}
                >
                  ✕
                </button>
                <span className="cond-doc-mock-tag">Not yet uploaded</span>
              </div>
            ) : (
              <button className="cond-doc-attach-btn" onClick={() => fileRef.current?.click()}>
                <span>📎</span> Attach Document
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorkspaceConditions({ loan }: Props) {
  const { token } = useAuth();
  const { conditions, loading, error, refetch } = useConditions(loan.id);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const filtered = filterTab === "all"
    ? conditions
    : conditions.filter((c) => c.status === filterTab);

  const counts = {
    open:      conditions.filter((c) => c.status === "open").length,
    submitted: conditions.filter((c) => c.status === "submitted").length,
    cleared:   conditions.filter((c) => c.status === "cleared").length,
    waived:    conditions.filter((c) => c.status === "waived").length,
    rejected:  conditions.filter((c) => c.status === "rejected").length,
  };

  async function handleAdd(form: { name: string; description: string; stage: ConditionStage }) {
    if (!token) return;
    setAddBusy(true);
    try {
      await createCondition(
        {
          loan_id: loan.id,
          name: form.name,
          description: form.description || undefined,
          stage: form.stage,
          condition_number: conditions.length + 1,
        },
        token,
      );
      setShowAdd(false);
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  if (loading) return <div className="cond-loading"><LoadingSpinner /></div>;

  if (error) {
    return (
      <div className="cond-empty">
        <p className="cond-empty-title">Could not load conditions</p>
        <p className="cond-empty-body">{error}</p>
        <button className="cond-btn cond-btn--ghost" onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div className="cond-wrapper">
      {/* ── Header ── */}
      <div className="cond-header">
        <div className="cond-header-left">
          <h2 className="cond-title">Conditions</h2>
          <span className="cond-loan-ref">{loan.loanNumber}</span>
        </div>
        <button
          className="cond-btn cond-btn--primary"
          onClick={() => setShowAdd((v) => !v)}
        >
          {showAdd ? "Cancel" : "+ Add Condition"}
        </button>
      </div>

      {/* ── Add form ── */}
      {showAdd && (
        <ConditionForm
          nextNumber={conditions.length + 1}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={addBusy}
        />
      )}

      {/* ── Stats row ── */}
      <div className="cond-stats">
        {(["open", "submitted", "cleared", "waived"] as const).map((s) => (
          <button
            key={s}
            className={`cond-stat-chip cond-stat--${s}${filterTab === s ? " active" : ""}`}
            onClick={() => setFilterTab((prev) => (prev === s ? "all" : s))}
          >
            <span className="cond-stat-count">{counts[s]}</span>
            <span className="cond-stat-label">{STATUS_LABELS[s]}</span>
          </button>
        ))}
        <span className="cond-stat-total">{conditions.length} total</span>
      </div>

      {/* ── Filter tabs ── */}
      <div className="cond-filter-tabs" role="tablist">
        {(["all", "open", "submitted", "cleared", "waived", "rejected"] as FilterTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={filterTab === t}
            className={`cond-filter-tab${filterTab === t ? " active" : ""}`}
            onClick={() => setFilterTab(t)}
          >
            {t === "all" ? "All" : STATUS_LABELS[t]}
            {t !== "all" && counts[t as keyof typeof counts] > 0 && (
              <span className="cond-filter-count">{counts[t as keyof typeof counts]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Condition list ── */}
      {filtered.length === 0 ? (
        <div className="cond-empty">
          <p className="cond-empty-title">
            {filterTab === "all" ? "No conditions on this loan" : `No ${filterTab} conditions`}
          </p>
          {filterTab === "all" && (
            <p className="cond-empty-body">Add conditions using the button above.</p>
          )}
        </div>
      ) : (
        <div className="cond-list">
          {filtered.map((c) => (
            <ConditionCard key={c.id} condition={c} onRefresh={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
