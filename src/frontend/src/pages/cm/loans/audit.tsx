/**
 * Full audit view — Module 6 (part 3) of the Capital Markets Workspace PoC.
 *
 * Per §14.3 #6: the audit view reconstructs the full chain for the demo loan
 * (lock → change → reprice → re-rank → allocation) with actors + timestamps.
 *
 * The backend returns a normalized list of entries from `cm_lock_events`,
 * `cm_eligibility_results`, `cm_best_execution_runs`, `cm_allocations`, and
 * the legacy `audit_log`. This page renders them in chronological order
 * grouped by source kind, with the per-entry actor + diff (when present).
 */
import { useRouter } from "next/router";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useLoanAuditChain } from "@/hooks/useCm";
import type { UserRole } from "@/types/auth";
import type { CMAuditEntry } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

function renderEntry(entry: CMAuditEntry, i: number) {
  if (entry.kind === "lock_event") {
    return (
      <div key={i} className="status-row">
        <div className="status-row-main">
          <strong>lock event: {entry.event_type.replace(/_/g, " ")}</strong>
          <span>lock <code>{entry.lock_id.slice(0, 8)}</code></span>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            actor {entry.actor_user_id ? <code>{entry.actor_user_id.slice(0, 8)}</code> : "—"} ·{" "}
            {formatDate(entry.occurred_at)}
          </span>
        </div>
      </div>
    );
  }
  if (entry.kind === "eligibility") {
    return (
      <div key={i} className="status-row">
        <div className="status-row-main">
          <strong>eligibility: {entry.passed ? "pass" : "fail"}</strong>
          <span>program <code>{entry.investor_program_id.slice(0, 8)}</code></span>
          {entry.failing_rules.length > 0 ? (
            <ul style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
              {entry.failing_rules.map((r, k) => (
                <li key={k}>
                  <code>{r.rule_code}</code> ({r.source}) — {String(r.observed)} {r.op}{" "}
                  {String(r.expected)}
                </li>
              ))}
            </ul>
          ) : null}
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            {formatDate(entry.evaluated_at)}
          </span>
        </div>
      </div>
    );
  }
  if (entry.kind === "best_ex_run") {
    return (
      <div key={i} className="status-row">
        <div className="status-row-main">
          <strong>best-ex run</strong>
          <span>{entry.rationale}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            chosen program{" "}
            {entry.chosen_investor_program_id ? (
              <code>{entry.chosen_investor_program_id.slice(0, 8)}</code>
            ) : (
              "—"
            )}{" "}
            · {formatDate(entry.evaluated_at)}
          </span>
        </div>
      </div>
    );
  }
  if (entry.kind === "allocation") {
    return (
      <div key={i} className="status-row">
        <div className="status-row-main">
          <strong>allocation ({entry.status})</strong>
          <span>
            program <code>{entry.investor_program_id.slice(0, 8)}</code>
            {entry.override_reason ? ` · override: ${entry.override_reason}` : ""}
          </span>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            by <code>{entry.allocated_by.slice(0, 8)}</code> · {formatDate(entry.allocated_at)}
          </span>
        </div>
      </div>
    );
  }
  // audit_log
  return (
    <div key={i} className="status-row">
      <div className="status-row-main">
        <strong>{entry.entity_type} · {entry.action}</strong>
        <span>
          id <code>{entry.entity_id.slice(0, 8)}</code> · actor{" "}
          {entry.actor_user_id ? <code>{entry.actor_user_id.slice(0, 8)}</code> : "—"}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          {formatDate(entry.occurred_at)}
        </span>
      </div>
    </div>
  );
}

export default function LoanAuditPage() {
  const router = useRouter();
  const loanId = typeof router.query.id === "string" ? router.query.id : null;
  const audit = useLoanAuditChain(loanId);

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Loan audit chain"
        description="Reconstruct the full chain — lock, change, reprice, re-rank, allocation — with actors and timestamps. §14.3 #6."
      />

      {audit.isError ? (
        <ErrorState
          title="Could not load audit chain"
          description={String((audit.error as Error)?.message ?? audit.error)}
        />
      ) : null}

      <section className="panel" aria-label="Audit chain">
        <header className="panel-heading">
          <h3>Chain</h3>
          <span>{audit.data?.length ?? 0} entries (oldest → newest)</span>
        </header>
        <div className="status-list">
          {(audit.data ?? []).map((e, i) => renderEntry(e, i))}
          {(audit.data ?? []).length === 0 && !audit.isLoading ? (
            <div className="status-row" style={{ color: "var(--muted)" }}>
              <div className="status-row-main">
                <span>No audit events for this loan.</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
