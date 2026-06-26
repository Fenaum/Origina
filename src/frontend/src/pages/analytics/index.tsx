// Analytics page — Phase 1+2+3+4 implementation.
//
// Loads KPIs, charts, and meta from GET /analytics/summary. Click any KPI or
// chart bar to drill into the underlying loans (POST /analytics/drilldown,
// surfaced via DrilldownPanel). Filter bar mutates the URL, which triggers a
// React Query refetch. Saved views are Phase 4.

import { useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRouter } from "next/router";

import { AnalyticsFilterBar } from "@/components/analytics/AnalyticsFilterBar";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartGridSkeleton } from "@/components/analytics/ChartGridSkeleton";
import { DrilldownPanel } from "@/components/analytics/DrilldownPanel";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { SavedViewsDropdown } from "@/components/analytics/SavedViewsDropdown";

import { ErrorState } from "@/components/feedback/ErrorState";

import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";

import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { useAnalyticsSummary } from "@/hooks/useAnalyticsSummary";

import { useAuth } from "@/state/auth";

import { formatCurrency } from "@/lib/utils";
import type { SavedView } from "@/types/analytics";
import type { UserRole } from "@/types/auth";

const PIE_COLORS = ["#1fa463", "#0d6b3b", "#91c7a2", "#5d6b62", "#c7d4cc", "#e9efe9"];

const ANALYTICS_ALLOWED_ROLES: UserRole[] = [
  "admin",
  "it_admin",
  "account_manager",
  "manager",
  "account_executive",
  "broker",
  "processor",
  "underwriter",
  "funder",
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { effectiveRole } = useAuth();
  const {
    filter,
    setFilter,
    drilldown,
    setDrilldown,
    viewId,
    setViewId,
    reset,
  } = useAnalyticsFilters();

  const { data, isLoading, isFetching, error, refetch } = useAnalyticsSummary(filter);

  // ── Drill-down callbacks ────────────────────────────────────────────────
  const handleKpiDrilldown = useCallback((key: string) => {
    setDrilldown(key);
  }, [setDrilldown]);

  const handleChartDrilldown = useCallback((field: "status" | "program", value: string) => {
    setDrilldown(`${field}:${value}`);
  }, [setDrilldown]);

  const handleLoanClick = useCallback((loanId: string) => {
    void router.push(`/loans/${loanId}`);
  }, [router]);

  // ── Saved views (Phase 4) ───────────────────────────────────────────────
  const handleLoadSavedView = useCallback((view: SavedView) => {
    setFilter({ ...view.filter_state });
    setViewId(view.id);
  }, [setFilter, setViewId]);

  // ── KPI strip ───────────────────────────────────────────────────────────
  const kpiSection = (
    <KpiStrip
      kpis={data?.kpis ?? []}
      loading={isLoading}
      onDrilldownClick={handleKpiDrilldown}
    />
  );

  // ── Charts ──────────────────────────────────────────────────────────────
  const chartsSection = (() => {
    if (isLoading) return <ChartGridSkeleton />;
    if (!data) return null;

    const statusCount = data.charts.status_count;
    const statusVolume = data.charts.status_volume;
    const channelMix = data.charts.channel_mix;
    const monthlySubmissions = data.charts.monthly_submissions;
    const agingByStatus = data.charts.aging_by_status;

    // Recharts formatters expect an optional value. Wrap them so the typed
    // signature is satisfied without losing the strict number handling.
    const currencyTooltip = (value: unknown): string =>
      formatCurrency(typeof value === "number" ? value : Number(value ?? 0));

    const agingTooltip = (value: unknown): string => {
      const n = typeof value === "number" ? value : Number(value ?? 0);
      return `${n.toFixed(1)} days`;
    };

    const channelTooltip = (value: unknown, _name: unknown, props: unknown): [string, string] => {
      const payload = (props as { payload?: { pct?: number; label?: string } } | undefined)?.payload;
      const n = typeof value === "number" ? value : Number(value ?? 0);
      const pct = payload?.pct;
      const label = payload?.label ?? "";
      return [`${n} loans${pct != null ? ` (${pct}%)` : ""}`, label];
    };

    return (
      <section className="chart-grid">
        <ChartCard
          title="Loan Count by Status"
          description="Active file distribution"
          isEmpty={statusCount.length === 0}
          onClick={() => handleChartDrilldown("status", statusCount[0]?.status ?? "submitted")}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusCount} margin={{ left: -20, right: 8, top: 12, bottom: 12 }}>
              <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(31, 164, 99, 0.08)" }} />
              <Bar
                dataKey="count"
                fill="#1fa463"
                radius={[6, 6, 0, 0]}
                onClick={(d) => handleChartDrilldown("status", (d as { status?: string }).status ?? "")}
                style={{ cursor: "pointer" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Volume by Status"
          description="Loan amount totals"
          isEmpty={statusVolume.length === 0}
          onClick={() => handleChartDrilldown("status", statusVolume[0]?.status ?? "submitted")}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusVolume} margin={{ left: -10, right: 8, top: 12, bottom: 12 }}>
              <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#5d6b62", fontSize: 12 }}
                tickLine={false}
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <Tooltip formatter={currencyTooltip} />
              <Bar
                dataKey="total_amount"
                fill="#0d6b3b"
                radius={[6, 6, 0, 0]}
                onClick={(d) => handleChartDrilldown("status", (d as { status?: string }).status ?? "")}
                style={{ cursor: "pointer" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Channel Mix"
          description="Loans by program"
          isEmpty={channelMix.length === 0}
          onClick={() => handleChartDrilldown("program", channelMix[0]?.program ?? "")}
        >
          <div className="donut-layout">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelMix}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {channelMix.map((entry, index) => (
                    <Cell
                      key={entry.program ?? index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      onClick={() => entry.program && handleChartDrilldown("program", entry.program)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={channelTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {channelMix.map((entry, index) => (
                <div key={entry.program ?? index}>
                  <span style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <strong>{entry.label}</strong>
                  <small>{entry.count} ({entry.pct}%)</small>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Aging by Status"
          description="Avg days in current status"
          isEmpty={agingByStatus.length === 0}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={agingByStatus}
              layout="vertical"
              margin={{ left: 16, right: 24, top: 12, bottom: 12 }}
            >
              <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: "#5d6b62", fontSize: 12 }}
                tickLine={false}
                width={140}
              />
              <Tooltip formatter={agingTooltip} />
              <Bar
                dataKey="avg_days"
                fill="#1fa463"
                radius={[0, 6, 6, 0]}
                onClick={(d) => handleChartDrilldown("status", (d as { status?: string }).status ?? "")}
                style={{ cursor: "pointer" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="chart-grid-wide">
          <ChartCard
            title="Monthly Submissions"
            description="Last 12 months"
            isEmpty={monthlySubmissions.length === 0}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySubmissions} margin={{ left: -20, right: 8, top: 12, bottom: 12 }}>
                <CartesianGrid stroke="#dbe7de" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#5d6b62", fontSize: 12 }} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0d6b3b" strokeWidth={2} dot={{ fill: "#1fa463" }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>
    );
  })();

  const meta = data?.meta;
  const roleLabel = effectiveRole ? effectiveRole.replace(/_/g, " ") : "Viewer";

  return (
    <AppLayout allowedRoles={ANALYTICS_ALLOWED_ROLES}>
      <div className="page-action-row">
        <PageHeader
          eyebrow={`Analytics · ${roleLabel}`}
          title="Pipeline Analytics"
          description="Volume trends, status distribution, channel mix, and open item breakdowns. Click any number to drill into the loans."
        />
        <div className="analytics-header-actions">
          <SavedViewsDropdown
            currentFilter={filter}
            currentViewId={viewId}
            onLoad={handleLoadSavedView}
            onClearActiveView={() => setViewId(null)}
            rolePreset={effectiveRole}
          />
          <button
            type="button"
            className="ghost-button"
            onClick={() => reset()}
            disabled={!filter.dateRange && filter.filters.length === 0 && !drilldown}
          >
            Reset
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {meta ? (
        <p className="data-freshness" aria-live="polite">
          Data as of {formatTimestamp(meta.computed_at)} · {meta.filter_summary || "No filters"}
        </p>
      ) : null}

      <AnalyticsFilterBar filter={filter} onChange={setFilter} />

      {error ? (
        <ErrorState
          title="Analytics unavailable"
          description={String((error as Error).message ?? error)}
          isRetrying={isFetching}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {kpiSection}
          {chartsSection}
        </>
      )}

      {drilldown ? (
        <DrilldownPanel
          filter={filter}
          metricContext={drilldown}
          title={drilldownTitle(drilldown)}
          onClose={() => setDrilldown(null)}
          onLoanClick={handleLoanClick}
        />
      ) : null}
    </AppLayout>
  );
}

function drilldownTitle(ctx: string): string {
  if (ctx.startsWith("status:")) {
    return `Loans in status: ${ctx.split(":")[1].replace(/_/g, " ")}`;
  }
  if (ctx.startsWith("program:")) {
    return `Loans in program: ${ctx.split(":")[1]}`;
  }
  switch (ctx) {
    case "open_conditions":       return "Loans with open conditions";
    case "submitted_conditions":  return "Loans with submitted conditions";
    case "open_exceptions":       return "Loans with open exceptions";
    case "stale_files":           return "Stale files (no update in 72h)";
    case "active_loans":          return "Active loans";
    default:                       return ctx;
  }
}