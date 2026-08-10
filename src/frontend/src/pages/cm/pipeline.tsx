/**
 * CM Pipeline — Module 2 of the Capital Markets Workspace PoC.
 *
 * Per §14.3 #1 the pipeline shows locked / floating / expected-funded
 * balances + every CM-active loan. Loans are filterable by lock status
 * (matches the Lock queue module's primary filter) and by loan program.
 * Each row links to the per-loan CM detail page.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useCMPipeline, useCmLoans } from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { LockStatus } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

const STATUS_FILTERS: Array<{ value: LockStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "requested", label: "Requested" },
  { value: "reprice_required", label: "Reprice required" },
  { value: "expired", label: "Expired" },
  { value: "extended", label: "Extended" },
  { value: "cancelled", label: "Cancelled" },
];

function formatBps(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(3)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function CMPipelinePage() {
  const pipeline = useCMPipeline();
  const [status, setStatus] = useState<LockStatus | "all">("all");
  const [program, setProgram] = useState<string>("all");
  const loans = useCmLoans(status === "all" ? {} : { status });

  // Distinct programs across the page's rows (client-side facet).
  const programs = useMemo(() => {
    const set = new Set<string>();
    (loans.data ?? []).forEach((l) => {
      if (l.loan_program) set.add(l.loan_program);
    });
    return Array.from(set).sort();
  }, [loans.data]);

  const filtered = useMemo(() => {
    const rows = loans.data ?? [];
    if (program === "all") return rows;
    return rows.filter((r) => r.loan_program === program);
  }, [loans.data, program]);

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Pipeline"
        description="Every CM-active loan. Balances reconcile to the cockpit tiles above."
      />

      {/* §14.3 #1 reconciliation strip */}
      <section className="metric-grid" aria-label="Reconciliation strip">
        <div className="metric-card success">
          <span>Locked</span>
          <strong>{formatCurrency(pipeline.data?.balances.locked ?? 0)}</strong>
        </div>
        <div className="metric-card">
          <span>Floating (requested)</span>
          <strong>{formatCurrency(pipeline.data?.balances.floating ?? 0)}</strong>
        </div>
        <div className="metric-card">
          <span>Expected funded</span>
          <strong>{formatCurrency(pipeline.data?.balances.expected_funded ?? 0)}</strong>
        </div>
        <div className="metric-card">
          <span>Total under lock</span>
          <strong>{formatCurrency(pipeline.data?.balances.total_under_lock ?? 0)}</strong>
        </div>
      </section>

      <section className="panel" aria-label="Filters">
        <header className="panel-heading">
          <h3>Filters</h3>
          <span>Status + program facets</span>
        </header>
        <div style={{ padding: "1rem 1.15rem", display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={status === f.value ? "nav-link active" : "nav-link"}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "999px",
                padding: "0.25rem 0.75rem",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
          <select
            aria-label="Loan program"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            style={{ marginLeft: "auto", padding: "0.25rem 0.5rem" }}
          >
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loans.isError ? (
        <ErrorState
          title="Could not load CM loans"
          description={String((loans.error as Error)?.message ?? loans.error)}
        />
      ) : null}

      <section className="panel" aria-label="Loans">
        <header className="panel-heading">
          <h3>Loans</h3>
          <span>{filtered.length} shown</span>
        </header>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Loan</th>
                <th style={{ padding: "0.75rem 1rem" }}>Program</th>
                <th style={{ padding: "0.75rem 1rem" }}>FICO / LTV</th>
                <th style={{ padding: "0.75rem 1rem" }}>Amount</th>
                <th style={{ padding: "0.75rem 1rem" }}>Lock</th>
                <th style={{ padding: "0.75rem 1rem" }}>Rate</th>
                <th style={{ padding: "0.75rem 1rem" }}>Net price</th>
                <th style={{ padding: "0.75rem 1rem" }}>Expires</th>
                <th style={{ padding: "0.75rem 1rem" }}>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
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
                  <td style={{ padding: "0.6rem 1rem" }}>
                    <span data-status={row.lock.status}>
                      {row.lock.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem 1rem" }}>{formatBps(row.lock.rate_bps)}</td>
                  <td style={{ padding: "0.6rem 1rem" }}>
                    {row.lock.net_price != null ? formatCurrency(row.lock.net_price) : "—"}
                  </td>
                  <td style={{ padding: "0.6rem 1rem" }}>{formatDate(row.lock.expires_at)}</td>
                  <td style={{ padding: "0.6rem 1rem" }}>
                    {row.open_alert_count > 0 ? (
                      <strong style={{ color: "var(--brand-strong)" }}>
                        {row.open_alert_count}
                      </strong>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loans.isLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: "1rem", color: "var(--muted)" }}>
                    No loans match the current filter.
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
