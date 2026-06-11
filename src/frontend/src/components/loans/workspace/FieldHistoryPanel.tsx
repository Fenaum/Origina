import { useEffect, useState } from "react";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { FieldHistoryEntry } from "@/types/api";
import type { FieldMeta } from "./FieldInfoPanel";

type Props = {
  loanId: string;
  meta: FieldMeta;
  onClose: () => void;
  onBackToInfo: () => void;
};

// Mock history used when the backend returns no results or errors
// TODO: Remove once audit triggers are confirmed to capture all workspace fields
function buildMockHistory(meta: FieldMeta): FieldHistoryEntry[] {
  return [
    {
      audit_log_id: "mock-1",
      entity_type: meta.table,
      entity_id:   "00000000-0000-0000-0000-000000000000",
      action:      "UPDATE",
      field_key:   meta.apiKey,
      old_value:   null,
      new_value:   "(initial value set)",
      changed_by:  null,
      changed_at:  new Date(Date.now() - 86_400_000 * 3).toISOString(),
    },
    {
      audit_log_id: "mock-2",
      entity_type: meta.table,
      entity_id:   "00000000-0000-0000-0000-000000000000",
      action:      "UPDATE",
      field_key:   meta.apiKey,
      old_value:   "(initial value set)",
      new_value:   "(updated by underwriter)",
      changed_by:  null,
      changed_at:  new Date(Date.now() - 3_600_000).toISOString(),
    },
  ];
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function FieldHistoryPanel({ loanId, meta, onClose, onBackToInfo }: Props) {
  const { token } = useAuth();
  const [history, setHistory]   = useState<FieldHistoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isMock,  setIsMock]    = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<FieldHistoryEntry[]>(`/loans/${loanId}/fields/${meta.apiKey}/history`, { token })
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) {
          setHistory(buildMockHistory(meta));
          setIsMock(true);
        } else {
          setHistory(data);
          setIsMock(false);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHistory(buildMockHistory(meta));
          setIsMock(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId, meta.apiKey, token]);

  return (
    <div className="field-panel-overlay" onClick={onClose}>
      <div className="field-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Field history">
        <div className="field-panel-header">
          <div>
            <h3 className="field-panel-title">Field History</h3>
            <code className="field-panel-api-key">{meta.apiKey}</code>
          </div>
          <div className="field-panel-header-actions">
            <button type="button" className="field-panel-back" onClick={onBackToInfo}>← Info</button>
            <button type="button" className="field-panel-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="field-panel-body">
          {isMock && (
            <div className="field-history-mock-notice">
              {/* TODO: Backend audit triggers capture changes to loan/borrower/financials.
                  If this field is not showing real history, confirm the audit trigger
                  covers the entity_type and field_key for this field. */}
              ℹ️ No audit history found for this field. Showing mock data for UI preview.
            </div>
          )}

          {loading ? (
            <p className="field-history-loading">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="field-history-empty">No changes recorded for this field.</p>
          ) : (
            <div className="field-history-list">
              {history.map((entry) => (
                <div key={entry.audit_log_id} className="field-history-entry">
                  <div className="field-history-meta">
                    <span className="field-history-action field-history-action--update">{entry.action}</span>
                    <span className="field-history-time">{timeAgo(entry.changed_at)}</span>
                    {entry.changed_by && (
                      <span className="field-history-by">by {entry.changed_by.slice(0, 8)}…</span>
                    )}
                  </div>
                  <div className="field-history-diff">
                    <div className="field-history-old">
                      <span className="field-history-diff-label">Before</span>
                      <code className="field-history-diff-value">{formatValue(entry.old_value)}</code>
                    </div>
                    <span className="field-history-arrow">→</span>
                    <div className="field-history-new">
                      <span className="field-history-diff-label">After</span>
                      <code className="field-history-diff-value field-history-diff-value--new">{formatValue(entry.new_value)}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
