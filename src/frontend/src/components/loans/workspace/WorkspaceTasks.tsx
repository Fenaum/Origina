import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import { TemplatePickerModal } from "@/components/loans/workspace/TemplatePickerModal";
import type { LoanSummary } from "@/types/loan";
import type { TaskOut, TaskStatus, TaskPriority, PaginatedResponse } from "@/types/api";
import type { TaskTemplate } from "@/data/templates";

type Props = { loan: LoanSummary };

type FilterTab = "all" | TaskStatus;

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  blocked:     "Blocked",
  done:        "Done",
  cancelled:   "Cancelled",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    "Low",
  normal: "Normal",
  high:   "High",
  urgent: "Urgent",
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due) < new Date();
}

// ── Task form (add / edit) ────────────────────────────────────────────────────

type FormState = {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string;
};

const EMPTY_FORM: FormState = {
  title: "", description: "", priority: "normal", status: "todo", due_at: "",
};

function TaskForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  function set(patch: Partial<FormState>) { setForm((f) => ({ ...f, ...patch })); }

  return (
    <div className="task-form">
      <div className="task-form-row task-form-row--full">
        <label className="task-form-label">Title <span className="task-form-required">*</span></label>
        <input
          className="task-form-input"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Task title…"
          autoFocus
        />
      </div>
      <div className="task-form-row task-form-row--full">
        <label className="task-form-label">Description</label>
        <textarea
          className="task-form-textarea"
          rows={2}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Optional details or instructions…"
        />
      </div>
      <div className="task-form-grid">
        <div className="task-form-row">
          <label className="task-form-label">Priority</label>
          <select className="task-form-select" value={form.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="task-form-row">
          <label className="task-form-label">Status</label>
          <select className="task-form-select" value={form.status} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="task-form-row">
          <label className="task-form-label">Due Date</label>
          <input type="date" className="task-form-input" value={form.due_at} onChange={(e) => set({ due_at: e.target.value })} />
        </div>
      </div>
      <div className="task-form-actions">
        <button type="button" className="task-btn task-btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button
          type="button"
          className="task-btn task-btn--primary"
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Task"}
        </button>
      </div>
    </div>
  );
}

// ── Single task card ──────────────────────────────────────────────────────────

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: TaskOut;
  onUpdate: (id: string, patch: Partial<FormState>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const overdue = isOverdue(task.due_at) && task.status !== "done" && task.status !== "cancelled";

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  async function cycleStatus() {
    const next: Record<TaskStatus, TaskStatus> = {
      todo: "in_progress", in_progress: "done", blocked: "done",
      done: "todo", cancelled: "todo",
    };
    await act(() => onUpdate(task.id, { status: next[task.status] }));
  }

  return (
    <div className={`task-card task-card--${task.status}${overdue ? " task-card--overdue" : ""}`}>
      {editing ? (
        <TaskForm
          initial={{
            title: task.title,
            description: task.description ?? "",
            priority: task.priority,
            status: task.status,
            due_at: task.due_at ? task.due_at.slice(0, 10) : "",
          }}
          saving={busy}
          onCancel={() => setEditing(false)}
          onSave={(f) => act(async () => {
            await onUpdate(task.id, f);
            setEditing(false);
          })}
        />
      ) : (
        <>
          <div className="task-card-top">
            <button
              type="button"
              className={`task-status-toggle task-status-toggle--${task.status}`}
              onClick={() => void cycleStatus()}
              disabled={busy}
              title={`Status: ${STATUS_LABELS[task.status]} — click to advance`}
            >
              {task.status === "done" ? "✓" : task.status === "cancelled" ? "✕" : ""}
            </button>
            <div className="task-card-body">
              <div className="task-card-title-row">
                <span className={`task-card-title${task.status === "done" ? " task-card-title--done" : ""}`}>
                  {task.title}
                </span>
                <span className={`task-priority-badge task-priority-badge--${task.priority}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                <span className={`task-status-pill task-status-pill--${task.status}`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
              {task.description && (
                <p className="task-card-desc">{task.description}</p>
              )}
              <div className="task-card-meta">
                {task.due_at && (
                  <span className={`task-due${overdue ? " task-due--overdue" : ""}`}>
                    Due {fmtDate(task.due_at)}{overdue ? " · Overdue" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="task-card-actions">
              <button
                type="button"
                className="task-card-btn"
                onClick={() => setEditing(true)}
                title="Edit task"
                disabled={busy}
              >
                ✎
              </button>
              <button
                type="button"
                className="task-card-btn task-card-btn--danger"
                onClick={() => {
                  if (confirm("Delete this task?")) void act(() => onDelete(task.id));
                }}
                title="Delete task"
                disabled={busy}
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WorkspaceTasks({ loan }: Props) {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiRequest<PaginatedResponse<TaskOut>>(`/tasks/?loan_id=${loan.id}`, { token })
      .then((data) => { if (!cancelled) setTasks(data.items ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const filtered = filterTab === "all" ? tasks : tasks.filter((t) => t.status === filterTab);

  const counts = {
    todo:        tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    blocked:     tasks.filter((t) => t.status === "blocked").length,
    done:        tasks.filter((t) => t.status === "done").length,
    cancelled:   tasks.filter((t) => t.status === "cancelled").length,
  };

  async function handleAdd(form: FormState) {
    if (!token) return;
    setAddBusy(true);
    try {
      const created = await apiRequest<TaskOut>("/tasks/", {
        token, method: "POST",
        body: JSON.stringify({
          loan_id: loan.id,
          tenant_id: "00000000-0000-0000-0000-000000000000", // stripped server-side
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          status: form.status,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        }),
      });
      setTasks((prev) => [created, ...prev]);
      setShowAdd(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function handleUpdate(id: string, patch: Partial<FormState>) {
    if (!token) return;
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description || null;
    if (patch.priority !== undefined) payload.priority = patch.priority;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.due_at !== undefined) payload.due_at = patch.due_at ? new Date(patch.due_at).toISOString() : null;
    const updated = await apiRequest<TaskOut>(`/tasks/${id}`, {
      token, method: "PATCH", body: JSON.stringify(payload),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
  }

  async function handleDelete(id: string) {
    if (!token) return;
    await apiRequest(`/tasks/${id}`, { token, method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleApplyTemplate(items: TaskTemplate[]) {
    if (!token) return;
    const created = await Promise.all(
      items.map((item, i) =>
        apiRequest<TaskOut>("/tasks/", {
          token,
          method: "POST",
          body: JSON.stringify({
            loan_id: loan.id,
            tenant_id: "00000000-0000-0000-0000-000000000000",
            title: item.title,
            description: item.description ?? null,
            priority: item.priority,
            status: "todo",
            due_at: null,
          }),
        }).then((t) => ({ ...t, _order: i }))
      ),
    );
    setTasks((prev) => [...created.sort((a, b) => a._order - b._order), ...prev]);
    setShowTemplate(false);
  }

  return (
    <div className="task-wrapper">
      {showTemplate && (
        <TemplatePickerModal
          type="task"
          onApply={(items) => handleApplyTemplate(items as TaskTemplate[])}
          onCancel={() => setShowTemplate(false)}
        />
      )}

      {/* Header */}
      <div className="task-header">
        <div className="task-header-left">
          <h2 className="task-header-title">Tasks</h2>
          <span className="task-header-sub">{loan.loanNumber}</span>
        </div>
        <div className="task-header-actions">
          <button type="button" className="task-btn task-btn--ghost" onClick={() => setShowTemplate(true)}>
            Apply Template
          </button>
          <button type="button" className="task-btn task-btn--primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "+ Add Task"}
          </button>
        </div>
      </div>

      {showAdd && (
        <TaskForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={addBusy}
        />
      )}

      {/* Stats */}
      <div className="task-stats">
        <div className="task-stat">
          <strong>{counts.todo}</strong><span>To Do</span>
        </div>
        <div className="task-stat task-stat--progress">
          <strong>{counts.in_progress}</strong><span>In Progress</span>
        </div>
        <div className="task-stat task-stat--blocked">
          <strong>{counts.blocked}</strong><span>Blocked</span>
        </div>
        <div className="task-stat task-stat--done">
          <strong>{counts.done}</strong><span>Done</span>
        </div>
        <span className="task-stat-total">{tasks.length} total</span>
      </div>

      {/* Filter tabs */}
      <div className="task-filter-tabs" role="tablist">
        {(["all", "todo", "in_progress", "blocked", "done", "cancelled"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={filterTab === tab}
            className={`task-filter-tab${filterTab === tab ? " active" : ""}`}
            onClick={() => setFilterTab(tab)}
          >
            {tab === "all" ? "All" : STATUS_LABELS[tab as TaskStatus]}
            {tab !== "all" && counts[tab as TaskStatus] > 0 && (
              <span className="task-filter-count">{counts[tab as TaskStatus]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading && <div className="task-loading">Loading tasks…</div>}
      {error && <div className="task-error">{error}</div>}
      {!loading && filtered.length === 0 && (
        <div className="task-empty">
          <p className="task-empty-title">
            {filterTab === "all" ? "No tasks on this loan" : `No ${filterTab.replace("_", " ")} tasks`}
          </p>
          {filterTab === "all" && (
            <p className="task-empty-body">
              Create a task manually or use <strong>Apply Template</strong> to add a standard checklist.
            </p>
          )}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="task-list">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
