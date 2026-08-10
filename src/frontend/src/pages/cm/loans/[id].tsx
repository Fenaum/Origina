/**
 * Loan CM detail — Module 4 of the Capital Markets Workspace PoC.
 *
 * Per §6.2 ("Loan CM detail"): per-loan lock summary, lock history, latest
 * best-ex, open alerts, pool membership, and the audit chain. The page
 * exposes the demo's "money moment": edit a registered field on the loan
 * via the workspace edit flow, return here, click Run material-change
 * watcher, and see the lock flip to REPRICE_REQUIRED.
 *
 * Best-ex + eligibility evaluation is split into a child page at
 * `/cm/loans/[id]/best-ex` to keep this page fast.
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  useAcknowledgeAlert,
  useDetectMaterialChange,
  useLoanAuditChain,
  useLoanCMSummary,
  useRepriceLoan,
} from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { CMAlertOut, CMLockOut } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(3)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function truncateHash(hash: string, n = 12): string {
  return hash.length > n ? `${hash.slice(0, n)}…` : hash;
}

export default function LoanCMDetailPage() {
  const router = useRouter();
  const loanId = typeof router.query.id === "string" ? router.query.id : null;

  const summary = useLoanCMSummary(loanId);
  const audit = useLoanAuditChain(loanId);
  const detectMut = useDetectMaterialChange();
  const repriceMut = useRepriceLoan();
  const ackMut = useAcknowledgeAlert();

  const [watcherResult, setWatcherResult] = useState<{
    flags: number;
    alerts: number;
    hits: Array<{ field: string; impact: string; severity: string; description: string }>;
    priorHash: string;
    currentHash: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function onRunWatcher() {
    if (!loanId) return;
    setActionError(null);
    try {
      const out = await detectMut.mutateAsync(loanId);
      setWatcherResult({
        flags: out.flags_raised,
        alerts: out.alerts_raised,
        hits: out.hits.map((h) => ({
          field: h.field,
          impact: h.impact,
          severity: h.severity,
          description: h.description,
        })),
        priorHash: out.prior_hash,
        currentHash: out.current_hash,
      });
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  async function onReprice() {
    if (!loanId) return;
    setActionError(null);
    try {
      await repriceMut.mutateAsync(loanId);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  async function onAckAlert(alert: CMAlertOut) {
    setActionError(null);
    try {
      await ackMut.mutateAsync(alert.id);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title={
          summary.data?.loan_number
            ? `Loan ${summary.data.loan_number}`
            : loanId
              ? `Loan ${loanId.slice(0, 8)}`
              : "Loan"
        }
        description="Per-loan CM detail — current lock, history, latest best-ex, open alerts, audit chain."
      />

      <section className="page-action-row" aria-label="Sub-navigation">
        <Link
          href={loanId ? `/cm/loans/${loanId}/best-ex` : "#"}
          className="nav-link"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "999px",
            padding: "0.3rem 0.9rem",
          }}
        >
          Investor comparison &amp; best-ex →
        </Link>
        <Link
          href={loanId ? `/cm/loans/${loanId}/audit` : "#"}
          className="nav-link"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "999px",
            padding: "0.3rem 0.9rem",
          }}
        >
          Full audit view →
        </Link>
      </section>

      {actionError ? (
        <ErrorState title="Action failed" description={actionError} />
      ) : null}

      {summary.isError ? (
        <ErrorState
          title="Could not load CM summary"
          description={String((summary.error as Error)?.message ?? summary.error)}
        />
      ) : null}

      {/* Demo controls (B15): re-run material-change watcher; trigger reprice */}
      <section className="panel" aria-label="Demo controls">
        <header className="panel-heading">
          <h3>Demo controls</h3>
          <span>§14.3 #3 — verify material change → reprice flow</span>
        </header>
        <div style={{ padding: "1rem 1.15rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRunWatcher}
            disabled={detectMut.isPending}
            className="nav-link"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "999px",
              padding: "0.4rem 1rem",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Run material-change watcher
          </button>
          <button
            type="button"
            onClick={onReprice}
            disabled={repriceMut.isPending}
            className="nav-link"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "999px",
              padding: "0.4rem 1rem",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Reprice loan
          </button>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem", alignSelf: "center" }}>
            Edit a registered field in the loan workspace first, then click watcher.
          </span>
        </div>
        {watcherResult ? (
          <div style={{ padding: "0 1.15rem 1rem 1.15rem" }}>
            <p>
              <strong>Watcher:</strong> {watcherResult.flags} flag(s), {watcherResult.alerts}{" "}
              alert(s) raised. Prior hash {truncateHash(watcherResult.priorHash)}, current{" "}
              {truncateHash(watcherResult.currentHash)}.
            </p>
            <ul>
              {watcherResult.hits.map((h, i) => (
                <li key={i}>
                  <code>{h.field}</code> — {h.impact} / {h.severity} — {h.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Current lock */}
      <CurrentLockPanel lock={summary.data?.current_lock ?? null} />

      {/* Open alerts */}
      <section className="panel" aria-label="Open alerts">
        <header className="panel-heading">
          <h3>Open alerts</h3>
          <span>{summary.data?.open_alerts?.length ?? 0} open</span>
        </header>
        <div className="status-list">
          {(summary.data?.open_alerts ?? []).map((a) => (
            <div key={a.id} className="status-row">
              <div className="status-row-main">
                <strong>{a.alert_type.replace(/_/g, " ")}</strong>
                <span>{a.message}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  Raised {formatDate(a.raised_at)}
                </span>
              </div>
              <div className="status-row-aside">
                <button
                  type="button"
                  onClick={() => onAckAlert(a)}
                  disabled={ackMut.isPending}
                  className="nav-link"
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "999px",
                    padding: "0.2rem 0.6rem",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
          {(summary.data?.open_alerts ?? []).length === 0 ? (
            <div className="status-row" style={{ color: "var(--muted)" }}>
              <div className="status-row-main">
                <span>No open alerts on this loan.</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Lock history */}
      <section className="panel" aria-label="Lock history">
        <header className="panel-heading">
          <h3>Lock history</h3>
          <span>{summary.data?.lock_history?.length ?? 0} locks (newest first)</span>
        </header>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "0.6rem 1rem" }}>Lock id</th>
                <th style={{ padding: "0.6rem 1rem" }}>Status</th>
                <th style={{ padding: "0.6rem 1rem" }}>Rate</th>
                <th style={{ padding: "0.6rem 1rem" }}>Net price</th>
                <th style={{ padding: "0.6rem 1rem" }}>Period</th>
                <th style={{ padding: "0.6rem 1rem" }}>Hash</th>
                <th style={{ padding: "0.6rem 1rem" }}>Requested</th>
                <th style={{ padding: "0.6rem 1rem" }}>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {(summary.data?.lock_history ?? []).map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 1rem" }}><code>{l.id.slice(0, 8)}</code></td>
                  <td style={{ padding: "0.5rem 1rem" }}>{l.status.replace(/_/g, " ")}</td>
                  <td style={{ padding: "0.5rem 1rem" }}>{formatBps(l.rate_bps)}</td>
                  <td style={{ padding: "0.5rem 1rem" }}>{formatCurrency(l.net_price)}</td>
                  <td style={{ padding: "0.5rem 1rem" }}>{l.lock_period_days}d</td>
                  <td style={{ padding: "0.5rem 1rem" }}>
                    <code title={l.snapshot_hash}>{truncateHash(l.snapshot_hash, 8)}</code>
                  </td>
                  <td style={{ padding: "0.5rem 1rem" }}>{formatDate(l.requested_at)}</td>
                  <td style={{ padding: "0.5rem 1rem" }}>{formatDate(l.confirmed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit chain preview */}
      <section className="panel" aria-label="Recent audit events">
        <header className="panel-heading">
          <h3>Audit chain (recent)</h3>
          <span>{audit.data?.length ?? 0} entries — full view → page</span>
        </header>
        <div className="status-list">
          {(audit.data ?? []).slice(0, 10).map((entry, i) => (
            <div key={i} className="status-row">
              <div className="status-row-main">
                <strong>{entry.kind.replace(/_/g, " ")}</strong>
                <span>
                  {entry.kind === "lock_event" && `event ${entry.event_type}`}
                  {entry.kind === "eligibility" && `passed ${entry.passed}`}
                  {entry.kind === "best_ex_run" && entry.rationale}
                  {entry.kind === "allocation" && `investor ${entry.investor_program_id.slice(0, 8)} (${entry.status})`}
                  {entry.kind === "audit_log" && `${entry.entity_type} ${entry.action}`}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  {formatDate(
                    entry.kind === "lock_event" ? entry.occurred_at :
                    entry.kind === "eligibility" ? entry.evaluated_at :
                    entry.kind === "best_ex_run" ? entry.evaluated_at :
                    entry.kind === "allocation" ? entry.allocated_at :
                    entry.occurred_at,
                  )}
                </span>
              </div>
            </div>
          ))}
          {(audit.data ?? []).length === 0 ? (
            <div className="status-row" style={{ color: "var(--muted)" }}>
              <div className="status-row-main">
                <span>No audit events yet.</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}

function CurrentLockPanel({ lock }: { lock: CMLockOut | null }) {
  if (!lock) {
    return (
      <section className="panel" aria-label="Current lock">
        <header className="panel-heading">
          <h3>Current lock</h3>
          <span>None</span>
        </header>
        <div style={{ padding: "1rem 1.15rem", color: "var(--muted)" }}>
          No active lock on this loan yet. Use the Lock queue or run a best-ex to start one.
        </div>
      </section>
    );
  }
  return (
    <section className="panel" aria-label="Current lock">
      <header className="panel-heading">
        <h3>Current lock</h3>
        <span>{lock.status.replace(/_/g, " ")}</span>
      </header>
      <div className="metric-grid" style={{ padding: "1rem" }}>
        <div className="metric-card success">
          <span>Rate</span>
          <strong>{formatBps(lock.rate_bps)}</strong>
        </div>
        <div className="metric-card">
          <span>Net price</span>
          <strong>{formatCurrency(lock.net_price)}</strong>
        </div>
        <div className="metric-card">
          <span>Lock period</span>
          <strong>{lock.lock_period_days}d</strong>
        </div>
        <div className="metric-card">
          <span>Calc version</span>
          <strong><code>{lock.calc_version}</code></strong>
        </div>
        <div className="metric-card">
          <span>Snapshot hash</span>
          <strong><code title={lock.snapshot_hash}>{truncateHash(lock.snapshot_hash, 14)}</code></strong>
        </div>
        <div className="metric-card">
          <span>Expires</span>
          <strong>{formatDate(lock.expires_at)}</strong>
        </div>
      </div>
      <div style={{ padding: "0 1.15rem 1rem 1.15rem", color: "var(--muted)", fontSize: "0.85rem" }}>
        Lock pricing reproduces from <code>snapshot_hash</code> + <code>snapshot_versions</code>;
        editing the loan does not retroactively change this number. Run the material-change
        watcher below to flag the lock when a registered field changes.
      </div>
    </section>
  );
}
