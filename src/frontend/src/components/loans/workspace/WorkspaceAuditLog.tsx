import { useEffect, useState } from "react";
import { listAuditLogs } from "@/services/auditService";
import { useAuth } from "@/state/auth";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { LoanSummary } from "@/types/loan";
import type { AuditLogEntry } from "@/types/api";

type Props = { loan: LoanSummary };

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

const ENTITY_LABEL: Record<string, string> = {
  loans: "Loan",
  loan_financials: "Financials",
  loan_terms: "Loan Terms",
  conditions: "Condition",
  documents: "Document",
  borrowers: "Borrower",
  notes: "Note",
  exceptions: "Exception",
  pricing_runs: "Pricing Run",
  eligibility_runs: "Eligibility Run",
  loan_status_events: "Status Change",
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function summarize(entry: AuditLogEntry): { field: string; before: string; after: string }[] {
  const diff = entry.diff ?? {};
  // Each diff key has shape {old, new}. Render the top-level keys as field names.
  return Object.entries(diff).slice(0, 6).map(([key, change]) => {
    if (change && typeof change === "object" && ("old" in change || "new" in change)) {
      const c = change as { old?: unknown; new?: unknown };
      return {
        field: key,
        before: c.old === null || c.old === undefined ? "—" : String(c.old),
        after: c.new === null || c.new === undefined ? "—" : String(c.new),
      };
    }
    return { field: key, before: "—", after: String(change) };
  });
}

export function WorkspaceAuditLog({ loan }: Props) {
  const { token } = useAuth();
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listAuditLogs(loan.id, token)
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loan.id, token]);

  const materialCount = events.filter((e) => e.action === "UPDATE" || e.action === "DELETE").length;
  const sourceCount = new Set(events.map((e) => e.entity_type)).size;

  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>System</span>
        <h2>Audit Log</h2>
        <p>System-focused event history for material file changes, submissions, documents, disclosures, and calculations on {loan.loanNumber}.</p>
      </div>

      <div className="workspace-summary-strip">
        <SummaryCard label="Events" value={String(events.length)} />
        <SummaryCard label="Material Changes" value={String(materialCount)} />
        <SummaryCard label="Sources" value={String(sourceCount)} />
        <SummaryCard label="Export" value="Ready" />
      </div>

      <section className="workspace-panel">
        <div className="documents-grid-header">
          <h3>Event History</h3>
          <div>
            <button type="button" disabled>Filter</button>
            <button type="button" disabled>Export</button>
          </div>
        </div>

        {loading && (
          <div className="workspace-skeleton audit-skeleton" aria-hidden>
            <div className="audit-skeleton-row" />
            <div className="audit-skeleton-row" />
            <div className="audit-skeleton-row" />
          </div>
        )}

        {!loading && events.length === 0 && (
          <EmptyState
            title="No audit events yet"
            description="Material changes to this loan file — status transitions, financial edits, document uploads — will appear here as they happen."
          />
        )}

        {!loading && events.length > 0 && (
          <div className="audit-table">
            <div className="audit-table-row audit-table-row--head">
              <span>Event</span>
              <span>Actor</span>
              <span>Field</span>
              <span>Before</span>
              <span>After</span>
              <span>Time</span>
            </div>
            {events.map((event) => {
              const change = summarize(event)[0];
              return (
                <div key={event.id} className="audit-table-row">
                  <span>
                    <strong>{ACTION_LABEL[event.action] ?? event.action}</strong>
                    <small>{ENTITY_LABEL[event.entity_type] ?? event.entity_type}</small>
                  </span>
                  <span>{event.actor_user_id ? "Team Member" : "System"}</span>
                  <span>{change?.field ?? "—"}</span>
                  <span>{change?.before ?? "—"}</span>
                  <span>{change?.after ?? "—"}</span>
                  <span>{fmtDateTime(event.occurred_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
