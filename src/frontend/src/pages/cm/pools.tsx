/**
 * Allocation & Pools — Module 6 (part 1) of the Capital Markets Workspace PoC.
 *
 * Per §6.2 ("Pool builder"): one sample pool with live WA stats. For the PoC
 * we render the list of pools (with their WA stats) and let the user create
 * a pool + add loans. Pool WA stats update live because they are computed
 * from `cm_pool_loans + loan_financials`, not persisted.
 *
 * Out of scope for the PoC: commitments, delivery, trade tickets, GoS
 * reconciliation. See §14.1 "Real vs mocked".
 */
import { useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAddLoanToPool, useCreatePool, usePools } from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { CMPoolOut } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

function formatBps(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(3)}%`;
}

export default function CMPoolsPage() {
  const pools = usePools();
  const createMut = useCreatePool();
  const addMut = useAddLoanToPool();

  const [name, setName] = useState("");
  const [poolType, setPoolType] = useState("bulk_whole_loan");
  const [actionError, setActionError] = useState<string | null>(null);

  async function onCreate() {
    setActionError(null);
    if (!name.trim()) {
      setActionError("Pool name is required.");
      return;
    }
    try {
      await createMut.mutateAsync({
        name: name.trim(),
        pool_type: poolType,
        target_investor_program_id: null,
      });
      setName("");
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Allocation &amp; Pools"
        description="One sample pool for the PoC. WA stats update live from loan financials."
      />

      {actionError ? (
        <ErrorState title="Action failed" description={actionError} />
      ) : null}
      {pools.isError ? (
        <ErrorState
          title="Could not load pools"
          description={String((pools.error as Error)?.message ?? pools.error)}
        />
      ) : null}

      {/* Create pool */}
      <section className="panel" aria-label="Create pool">
        <header className="panel-heading">
          <h3>Create pool</h3>
          <span>§14.3 #5 — allocation + live WA stats</span>
        </header>
        <div
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            gap: "0.6rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            aria-label="Pool name"
            placeholder="e.g. 2026-Q3 Bulk DSCR"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", minWidth: "20rem" }}
          />
          <select
            aria-label="Pool type"
            value={poolType}
            onChange={(e) => setPoolType(e.target.value)}
            style={{ padding: "0.4rem 0.6rem" }}
          >
            <option value="bulk_whole_loan">Bulk whole loan</option>
            <option value="seasoned">Seasoned</option>
            <option value="scratch_pad">Scratch pad</option>
          </select>
          <button
            type="button"
            onClick={onCreate}
            disabled={createMut.isPending}
            className="nav-link active"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "999px",
              padding: "0.4rem 1rem",
              cursor: "pointer",
            }}
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </section>

      {/* Pool list */}
      <section className="panel" aria-label="Pool list">
        <header className="panel-heading">
          <h3>Pools</h3>
          <span>{pools.data?.length ?? 0} pools</span>
        </header>
        <div className="status-list">
          {(pools.data ?? []).map((p) => (
            <PoolRow key={p.id} pool={p} onAddLoan={(loanId) => addMut.mutateAsync({ poolId: p.id, loanId: loanId }).catch(() => null)} />
          ))}
          {(pools.data ?? []).length === 0 ? (
            <div className="status-row" style={{ color: "var(--muted)" }}>
              <div className="status-row-main">
                <span>No pools yet. Create one above.</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}

function PoolRow({ pool, onAddLoan }: { pool: CMPoolOut; onAddLoan: (loanId: string) => void }) {
  const [loanId, setLoanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wa = pool.wa_stats;

  async function onClick() {
    if (!loanId.trim()) {
      setError("Loan id required");
      return;
    }
    setError(null);
    try {
      await onAddLoan(loanId.trim());
      setLoanId("");
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <div className="status-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <div className="status-row-main">
          <strong>{pool.name}</strong>
          <span>
            {pool.pool_type.replace(/_/g, " ")} · {pool.status} · {pool.loan_count} loan(s) ·{" "}
            {formatCurrency(wa.total_balance)}
          </span>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            WA FICO {wa.avg_fico?.toFixed(0) ?? "—"} · WA LTV{" "}
            {wa.avg_ltv != null ? `${wa.avg_ltv.toFixed(1)}%` : "—"} · WA rate{" "}
            {formatBps(wa.weighted_rate_bps)}
          </span>
          {error ? <span style={{ color: "var(--brand-strong)" }}>{error}</span> : null}
        </div>
        <div className="status-row-aside">
          <input
            aria-label="Loan id"
            placeholder="loan id"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            style={{ padding: "0.2rem 0.4rem", minWidth: "12rem" }}
          />
          <button
            type="button"
            onClick={onClick}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "999px",
              padding: "0.2rem 0.6rem",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Add loan
          </button>
        </div>
      </div>
    </div>
  );
}
