import { useMemo, useState } from "react";
import { useAnalyticsSummary } from "@/hooks/useAnalyticsSummary";
import type { AnalyticsFilter, DatePreset } from "@/types/analytics";
import { TeamKPICard } from "@/components/dashboard/manager/TeamKPICard";

/**
 * ManagerDashboardContent — the data-driven body of the manager dashboard.
 *
 * Lives separately from the role-routed page wrapper so:
 *   - The page (`pages/dashboard/manager.tsx`) owns auth/role guards.
 *   - This component owns data fetching + KPI tile composition. Tests can
 *     mock `useAnalyticsSummary` and render the content directly.
 *
 * Data source: GET /api/v1/analytics/summary (already wired by useAnalyticsSummary).
 * A manager can switch the date preset and see the KPIs refetch.
 */
export function ManagerDashboardContent() {
  const [preset, setPreset] = useState<DatePreset>("last_30_days");

  const filter = useMemo<AnalyticsFilter>(
    () => ({
      dateRange: { field: "submitted_at", preset },
      filters: [],
      sort: [{ field: "updated_at", direction: "desc" }],
      page: 1,
      limit: 25,
    }),
    [preset],
  );

  const { data, isLoading, isError } = useAnalyticsSummary(filter);

  if (isLoading) {
    return <div className="manager-dashboard-loading">Loading team metrics…</div>;
  }
  if (isError || !data) {
    return (
      <div className="manager-dashboard-error" role="alert">
        Unable to load team metrics. Refresh the page or contact your administrator.
      </div>
    );
  }

  const kpis = data.kpis;

  return (
    <section className="manager-dashboard-content" aria-label="Team metrics">
      <header className="manager-dashboard-header">
        <h3>Team Metrics</h3>
        <label className="manager-dashboard-preset">
          <span>Date range</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            data-testid="manager-preset-select"
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="year_to_date">Year to date</option>
          </select>
        </label>
      </header>

      <div className="manager-dashboard-grid" data-testid="manager-kpi-grid">
        {kpis.map((kpi) => (
          <TeamKPICard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <p className="manager-dashboard-meta">
        Data as of {new Date(data.meta.computed_at).toLocaleString()}
      </p>
    </section>
  );
}
