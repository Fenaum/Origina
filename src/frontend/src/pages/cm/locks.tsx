/**
 * CM Lock queue — Module 3 of the Capital Markets Workspace PoC.
 *
 * Drives three work queues:
 *   - Requested locks waiting for confirm (the Lock Desk's primary work)
 *   - Confirmed locks needing attention (expiring soon, reprice_required)
 *   - Recently expired (audit/replay context)
 *
 * Defaults to ?status=requested so the queue shows actionable work first;
 * the status pill set on the Pipeline page deep-links to the same filter.
 * Confirm / Expire / Reprice actions are wired via React Query mutations;
 * PIN 2 (requester ≠ approver) is enforced server-side; the UI surfaces
 * 403s as inline error messages.
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  useConfirmLock,
  useCmLoans,
  useExpireLock,
  useRepriceLoan,
} from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { LockStatus } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

const QUEUE_TABS: Array<{ value: LockStatus; label: string }> = [
  { value: "requested", label: "Requested" },
  { value: "reprice_required", label: "Reprice required" },
  { value: "confirmed", label: "Confirmed" },
  { value: "expired", label: "Expired" },
];

function formatBps(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(3)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export default function CMLockQueuePage() {
  const router = useRouter();
  // tab is derived directly from router.query on every render — no local
  // state, no effect. Deep-linkable (?status=requested) and back/forward
  // navigation work for free.
  const tab: LockStatus =
    typeof router.query.status === "string"
      ? (router.query.status as LockStatus)
      : "requested";

  const queue = useCmLoans({ status: tab });
  const confirmMut = useConfirmLock();
  const expireMut = useExpireLock();
  const repriceMut = useRepriceLoan();

  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo(() => queue.data ?? [], [queue.data]);

  async function onConfirm(lockId: string) {
    setActionError(null);
    try {
      await confirmMut.mutateAsync(lockId);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  async function onExpire(lockId: string) {
    setActionError(null);
    try {
      await expireMut.mutateAsync(lockId);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  async function onReprice(loanId: string) {
    setActionError(null);
    try {
      await repriceMut.mutateAsync(loanId);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Lock Queue"
        description="Requested locks awaiting confirm, locks flagged for reprice, and recently expired. Confirm/expire/reprice actions enforce PIN 2 (different approver than requester) server-side."
      />

      <section className="panel" aria-label="Queue selector">
        <header className="panel-heading">
          <h3>Queues</h3>
          <span>Click a tab to switch work list</span>
        </header>
        <div style={{ padding: "1rem 1.15rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {QUEUE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                router.replace({ pathname: "/cm/locks", query: { status: t.value } }, undefined, {
                  shallow: true,
                });
              }}
              className={tab === t.value ? "nav-link active" : "nav-link"}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "999px",
                padding: "0.25rem 0.75rem",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
              {queue.data && (
                <span style={{ marginLeft: "0.4rem", color: "var(--muted)" }}>
                  ({queue.data.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {actionError ? (
        <ErrorState title="Action failed" description={actionError} />
      ) : null}
      {queue.isError ? (
        <ErrorState
          title="Could not load queue"
          description={String((queue.error as Error)?.message ?? queue.error)}
        />
      ) : null}

      <section className="panel" aria-label="Lock rows">
        <header className="panel-heading">
          <h3>{tab.replace(/_/g, " ")} locks</h3>
          <span>{rows.length} loans</span>
        </header>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Loan</th>
                <th style={{ padding: "0.75rem 1rem" }}>Program</th>
                <th style={{ padding: "0.75rem 1rem" }}>FICO / LTV</th>
                <th style={{ padding: "0.75rem 1rem" }}>Amount</th>
                <th style={{ padding: "0.75rem 1rem" }}>Rate</th>
                <th style={{ padding: "0.75rem 1rem" }}>Net price</th>
                <th style={{ padding: "0.75rem 1rem" }}>Period</th>
                <th style={{ padding: "0.75rem 1rem" }}>Expires in</th>
                <th style={{ padding: "0.75rem 1rem" }}>Reprice flag</th>
                <th style={{ padding: "0.75rem 1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const days = daysUntil(row.lock.expires_at);
                const prior = row.lock.prior_lock_id;
                return (
                  <tr key={row.loan_id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <Link href={`/cm/loans/${row.loan_id}`}>
                        {row.loan_number ?? row.loan_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>{row.loan_program ?? "—"}</td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {row.fico_score ?? "—"} / {row.ltv != null ? `${row.ltv.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {formatCurrency(row.loan_amount ?? 0)}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>{formatBps(row.lock.rate_bps)}</td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {row.lock.net_price != null ? formatCurrency(row.lock.net_price) : "—"}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>{row.lock.lock_period_days}d</td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {days == null ? "—" : `${days}d (${formatDate(row.lock.expires_at)})`}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      {row.lock.reprice_required_at ? (
                        <strong style={{ color: "var(--brand-strong)" }}>flagged</strong>
                      ) : prior ? (
                        <span style={{ color: "var(--muted)" }}>repriced</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {tab === "requested" && (
                          <button
                            type="button"
                            onClick={() => onConfirm(row.lock.id)}
                            disabled={confirmMut.isPending}
                            className="nav-link"
                            style={{
                              border: "1px solid var(--line)",
                              borderRadius: "999px",
                              padding: "0.2rem 0.6rem",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          >
                            Confirm
                          </button>
                        )}
                        {(tab === "confirmed" || tab === "reprice_required") && (
                          <button
                            type="button"
                            onClick={() => onReprice(row.loan_id)}
                            disabled={repriceMut.isPending}
                            className="nav-link"
                            style={{
                              border: "1px solid var(--line)",
                              borderRadius: "999px",
                              padding: "0.2rem 0.6rem",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          >
                            Reprice
                          </button>
                        )}
                        {(tab === "confirmed" || tab === "reprice_required") && (
                          <button
                            type="button"
                            onClick={() => onExpire(row.lock.id)}
                            disabled={expireMut.isPending}
                            className="nav-link"
                            style={{
                              border: "1px solid var(--line)",
                              borderRadius: "999px",
                              padding: "0.2rem 0.6rem",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          >
                            Expire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !queue.isLoading ? (
                <tr>
                  <td colSpan={10} style={{ padding: "1rem", color: "var(--muted)" }}>
                    Nothing in this queue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
