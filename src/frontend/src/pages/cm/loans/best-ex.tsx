/**
 * Investor comparison / Best-ex — Module 5 of the Capital Markets Workspace PoC.
 *
 * Per §6.2 ("Investor comparison / Best execution"):
 *  - Run a best-ex against every active investor program
 *  - Show the eligibility pass/fail per program (with the failing rules)
 *  - Show the ranked net execution table with the chosen program
 *  - Persist + re-rank on demand
 *
 * Two control inputs: lock_period_days (15/30/45/60) and the demo market-
 * shift knob (-25 to +25 bps, client-side only — drives a manual rate
 * override before the next best-ex run).
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  useCreateAllocation,
  useRunBestEx,
} from "@/hooks/useCm";
import { formatCurrency } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import type { CMBestExRankedRow, MarketShiftDelta } from "@/types/api";
import {
  getMarketShift,
  setMarketShift,
} from "@/services/cmService";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(3)}%`;
}

function formatCurrency0(n: number): string {
  return formatCurrency(n);
}

export default function LoanBestExPage() {
  const router = useRouter();
  const loanId = typeof router.query.id === "string" ? router.query.id : null;

  const [lockPeriodDays, setLockPeriodDays] = useState<number>(30);
  // marketShift is intentionally read-on-demand (no useState + useEffect).
  // The value is kept in localStorage by the service module so SSR/CSR
  // mismatches don't matter — we only need it at click time.
  function onShiftChange(next: MarketShiftDelta) {
    setMarketShift(next);
  }

  const bestExMut = useRunBestEx();
  const allocateMut = useCreateAllocation();
  const [actionError, setActionError] = useState<string | null>(null);

  async function onRun() {
    if (!loanId) return;
    setActionError(null);
    try {
      await bestExMut.mutateAsync({ loan_id: loanId, lock_period_days: lockPeriodDays });
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  async function onAllocate(row: CMBestExRankedRow) {
    if (!loanId || !bestExMut.data) return;
    setActionError(null);
    try {
      await allocateMut.mutateAsync({
        loan_id: loanId,
        best_execution_run_id: bestExMut.data.run_id,
        investor_program_id: row.investor_program_id,
        notes: `Allocated via Best-Ex (rank #${row.rank})`,
      });
    } catch (e) {
      setActionError(String((e as Error)?.message ?? e));
    }
  }

  const out = bestExMut.data;
  const ranked = useMemo(() => out?.ranked ?? [], [out]);

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Investor Comparison &amp; Best-ex"
        description="Ranked net execution across every active investor program, with eligibility pass/fail. Every line is traceable to a versioned rate sheet + LLPA grid."
      >
      </PageHeader>

      <section className="page-action-row" aria-label="Sub-navigation">
        <Link
          href={loanId ? `/cm/loans/${loanId}` : "#"}
          className="nav-link"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "999px",
            padding: "0.3rem 0.9rem",
          }}
        >
          ← Back to loan CM detail
        </Link>
      </section>

      {/* Run controls */}
      <section className="panel" aria-label="Run controls">
        <header className="panel-heading">
          <h3>Run best-ex</h3>
          <span>§14.3 #4 — eligibility + ranked execution</span>
        </header>
        <div
          style={{
            padding: "1rem 1.15rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            Lock period:
            <select
              value={lockPeriodDays}
              onChange={(e) => setLockPeriodDays(Number(e.target.value))}
              style={{ padding: "0.2rem 0.4rem" }}
            >
              {[15, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            Market shift (demo):
            <select
              value={getMarketShift()}
              onChange={(e) => onShiftChange(Number(e.target.value) as MarketShiftDelta)}
              style={{ padding: "0.2rem 0.4rem" }}
            >
              <option value={-25}>−25 bps</option>
              <option value={-10}>−10 bps</option>
              <option value={0}>0 bps</option>
              <option value={10}>+10 bps</option>
              <option value={25}>+25 bps</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onRun}
            disabled={bestExMut.isPending || !loanId}
            className="nav-link active"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "999px",
              padding: "0.4rem 1rem",
              cursor: "pointer",
            }}
          >
            {bestExMut.isPending ? "Running…" : "Run best-ex"}
          </button>
          {getMarketShift() !== 0 ? (
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Note: market shift is a client-side knob for the demo — it does not
              mutate the published rate sheet. The next best-ex run still uses
              the versioned sheet snapshot.
            </span>
          ) : null}
        </div>
      </section>

      {actionError ? (
        <ErrorState title="Action failed" description={actionError} />
      ) : null}

      {/* Rationale */}
      {out ? (
        <section className="panel" aria-label="Rationale">
          <header className="panel-heading">
            <h3>Rationale</h3>
            <span>Snapshot hash {out.snapshot_hash.slice(0, 14)}…</span>
          </header>
          <div style={{ padding: "1rem 1.15rem" }}>
            <p>{out.rationale}</p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Calc version <code>{out.calc_version}</code>; evaluated{" "}
              {new Date(out.evaluated_at).toISOString().slice(0, 16).replace("T", " ")}
            </p>
          </div>
        </section>
      ) : null}

      {/* Ranked table */}
      <section className="panel" aria-label="Ranked execution table">
        <header className="panel-heading">
          <h3>Ranked execution</h3>
          <span>
            {out ? `${ranked.length} programs evaluated` : "Run best-ex to populate"}
          </span>
        </header>
        {out ? (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "0.6rem 1rem" }}>Rank</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Investor / Program</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Eligibility</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Rate</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Base</th>
                  <th style={{ padding: "0.6rem 1rem" }}>SRP</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Delivery</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Net proceeds</th>
                  <th style={{ padding: "0.6rem 1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => (
                  <tr
                    key={`${row.investor_program_id}-${i}`}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      background:
                        out.chosen && out.chosen.investor_program_id === row.investor_program_id
                          ? "rgba(13, 122, 69, 0.06)"
                          : undefined,
                    }}
                  >
                    <td style={{ padding: "0.5rem 1rem" }}>
                      #{row.rank}
                      {out.chosen && out.chosen.investor_program_id === row.investor_program_id ? (
                        <span style={{ color: "var(--brand-strong)", marginLeft: "0.4rem" }}>
                          (chosen)
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <strong>{row.investor_name}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        {row.program_name}
                      </div>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {row.eligibility_passed ? (
                        <span style={{ color: "var(--brand-strong)" }}>pass</span>
                      ) : (
                        <details>
                          <summary style={{ color: "var(--brand-strong)", cursor: "pointer" }}>
                            fail
                          </summary>
                          <ul style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
                            {row.failing_rules.map((r, k) => (
                              <li key={k}>
                                <code>{r.rule_code}</code> ({r.source}) — observed {String(r.observed)}{" "}
                                {r.op} {String(r.expected)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{formatBps(row.rate_bps)}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>{formatCurrency0(row.base_price)}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>{formatBps(row.srp_bps)}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>{formatCurrency0(row.delivery_fee)}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <strong>{formatCurrency0(row.net_proceeds)}</strong>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {row.eligibility_passed && loanId ? (
                        <button
                          type="button"
                          onClick={() => onAllocate(row)}
                          disabled={allocateMut.isPending || !bestExMut.data}
                          className="nav-link"
                          style={{
                            border: "1px solid var(--line)",
                            borderRadius: "999px",
                            padding: "0.2rem 0.6rem",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          Allocate
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "1rem 1.15rem", color: "var(--muted)" }}>
            No best-ex run yet. Use Run best-ex to populate.
          </div>
        )}
      </section>
    </AppLayout>
  );
}
