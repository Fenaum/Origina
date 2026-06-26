// DrilldownPanel — slide-up panel showing the loans that produced a metric.
// Opens when a metric_context is set; closes when the user clicks X or clicks
// outside the panel.
//
// The panel reuses the active global filter (so the user's filter bar state is
// preserved) and layers the metric_context on top. Pagination is local state
// for now; future versions may persist the page in the URL.

import { useMemo, useState } from "react";
import { DrilldownTable } from "@/components/analytics/DrilldownTable";
import { useAnalyticsDrilldown } from "@/hooks/useAnalyticsDrilldown";
import { exportDrilldown } from "@/services/analyticsService";
import { useAuth } from "@/state/auth";
import type { AnalyticsFilter, DrilldownRequest } from "@/types/analytics";
import { formatCurrency } from "@/lib/utils";

type DrilldownPanelProps = {
  filter: AnalyticsFilter;
  metricContext: string;
  title: string;
  onClose: () => void;
  onLoanClick?: (loanId: string) => void;
};

const PAGE_SIZE = 25;

export function DrilldownPanel({
  filter,
  metricContext,
  title,
  onClose,
  onLoanClick,
}: DrilldownPanelProps) {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const request: DrilldownRequest = useMemo(
    () => ({
      ...filter,
      metric_context: metricContext,
      page,
      limit: PAGE_SIZE,
    }),
    [filter, metricContext, page],
  );

  const { data, isLoading, error } = useAnalyticsDrilldown(request, Boolean(metricContext));

  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const columns = data?.columns ?? [
    "loan_number", "borrower_name", "status", "loan_amount",
    "days_in_status", "open_conditions",
  ];

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportDrilldown({ ...filter, metric_context: metricContext, limit: 5000, page: 1 }, token ?? undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `origina_${metricContext.replace(/[^a-z0-9_]/gi, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="drilldown-overlay" onClick={onClose} aria-hidden />
      <aside className="drilldown-panel fade-slide-in" aria-label={`Drill-down: ${title}`}>
        <header className="drilldown-header">
          <div>
            <h3>{title}</h3>
            <span className="drilldown-subtitle">
              {total} loan{total === 1 ? "" : "s"}
              {total > 0 ? ` · ${formatCurrency(rows.reduce((s, r) => s + (r.loan_amount ?? 0), 0))}` : ""}
            </span>
          </div>
          <div className="drilldown-header-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={handleExport}
              disabled={exporting || total === 0}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              aria-label="Close drilldown"
            >
              ✕ Close
            </button>
          </div>
        </header>

        {error ? (
          <div className="inline-empty-state">
            <h4>Couldn't load loans</h4>
            <p>{String((error as Error).message ?? error)}</p>
          </div>
        ) : (
          <>
            <DrilldownTable
              rows={rows}
              columns={columns}
              loading={isLoading}
              onRowClick={onLoanClick}
            />

            <footer className="drilldown-footer">
              <span>
                Page {page} of {lastPage} · {total} total
              </span>
              <div className="drilldown-pagination">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage || isLoading}
                >
                  Next →
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}