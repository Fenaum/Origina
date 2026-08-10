/**
 * CM Cockpit — Module 1 of the Capital Markets Workspace PoC.
 *
 * Per docs/CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §6.1 (Cockpit) and the
 * Milestone 3 backlog item B10. Renders the live position summary from
 * `GET /cm/pipeline`: locked / floating / expected-funded balances, lock
 * counts by status, and open-alert count. Every tile drills into the
 * matching module.
 *
 * Tile-level links are wired to the other CM pages so a single click from
 * the cockpit moves to the relevant work queue (Pipeline / Lock queue /
 * Alerts).
 */
import Link from "next/link";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAlerts, useCMPipeline } from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

function fmtCount(n: number | undefined): string {
  return n == null ? "—" : n.toLocaleString();
}

export default function CMCockpitPage() {
  const pipeline = useCMPipeline();
  const alerts = useAlerts("open");

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="CM Cockpit"
        description="Live position across the locked book — drill into Pipeline, Locks, or Pools from any tile. Demo data is deterministic; rate-sheet versions are reproducible."
      />

      {pipeline.isError ? (
        <ErrorState
          title="Could not load CM cockpit"
          description={String((pipeline.error as Error)?.message ?? pipeline.error)}
        />
      ) : null}

      <section className="metric-grid" aria-label="CM position summary">
        <Link href="/cm/pipeline" className="metric-card-link">
          <div className="metric-card success">
            <span>Locked</span>
            <strong>{formatCurrency(pipeline.data?.balances.locked ?? 0)}</strong>
            <p>
              Confirmed &amp; reprice-required locks across{" "}
              {fmtCount(
                (pipeline.data?.lock_counts.confirmed ?? 0) +
                (pipeline.data?.lock_counts.reprice_required ?? 0) +
                (pipeline.data?.lock_counts.extended ?? 0),
              )}{" "}
              loans
            </p>
          </div>
        </Link>

        <Link href="/cm/pipeline" className="metric-card-link">
          <div className="metric-card">
            <span>Floating</span>
            <strong>{formatCurrency(pipeline.data?.balances.floating ?? 0)}</strong>
            <p>
              {fmtCount(pipeline.data?.lock_counts.requested ?? 0)} requested locks awaiting
              confirm
            </p>
          </div>
        </Link>

        <Link href="/cm/pipeline" className="metric-card-link">
          <div className="metric-card">
            <span>Expected Funded</span>
            <strong>
              {formatCurrency(pipeline.data?.balances.expected_funded ?? 0)}
            </strong>
            <p>
              {fmtCount(pipeline.data?.lock_counts.funded_delivered ?? 0)} funded / delivered
              locks
            </p>
          </div>
        </Link>

        <Link href="/cm/alerts" className="metric-card-link">
          <div
            className={
              (pipeline.data?.open_alerts ?? 0) > 0
                ? "metric-card warning"
                : "metric-card"
            }
          >
            <span>Open Alerts</span>
            <strong>{fmtCount(pipeline.data?.open_alerts)}</strong>
            <p>
              {alerts.data && alerts.data.length > 0
                ? alerts.data
                    .slice(0, 3)
                    .map((a) => a.alert_type.replace(/_/g, " "))
                    .join(" · ")
                : "No open alerts — book is clean."}
            </p>
          </div>
        </Link>
      </section>

      <section className="panel" aria-label="Lock counts by status">
        <header className="panel-heading">
          <h3>Lock counts by status</h3>
          <span>Click a status to filter the lock queue</span>
        </header>
        <div className="metric-grid" style={{ padding: "1rem" }}>
          {(
            [
              "confirmed",
              "requested",
              "reprice_required",
              "expired",
              "extended",
              "cancelled",
              "funded_delivered",
            ] as const
          ).map((status) => (
            <Link
              key={status}
              href={`/cm/locks?status=${status}`}
              className="metric-card-link"
            >
              <div className="metric-card">
                <span>{status.replace(/_/g, " ")}</span>
                <strong>{fmtCount(pipeline.data?.lock_counts[status])}</strong>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel" aria-label="Module quick links">
        <header className="panel-heading">
          <h3>Modules</h3>
          <span>Six-module workspace (PoC scope)</span>
        </header>
        <div className="status-list">
          {[
            { label: "CM Pipeline", href: "/cm/pipeline", hint: "All CM-active loans" },
            { label: "Lock Queue", href: "/cm/locks", hint: "Requested / expiring / reprice-required" },
            { label: "Loan CM detail", href: "/cm/pipeline", hint: "Open a loan to see its CM detail, history, audit" },
            { label: "Allocation & Pools", href: "/cm/pools", hint: "Live WA stats + sample pool" },
            { label: "Alerts", href: "/cm/alerts", hint: "Reprice / eligibility / floor" },
          ].map((m) => (
            <Link key={m.href} href={m.href} className="status-row">
              <div className="status-row-main">
                <strong>{m.label}</strong>
                <span>{m.hint}</span>
              </div>
              <div className="status-row-aside">
                <p>Open →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
