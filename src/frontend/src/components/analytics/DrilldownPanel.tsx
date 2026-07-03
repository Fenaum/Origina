// DrilldownPanel — slide-up panel showing the loans that produced a metric.
//
// Visuals: blurred dark overlay, gradient header strip, branded chip on the
// title, animated slide-up entrance, polished pagination footer with
// accessible page indicator. Body reuses DrilldownTable for the row layout.

import { useMemo, useState } from "react";
import { DrilldownTable } from "@/components/analytics/DrilldownTable";
import { useAnalyticsDrilldown } from "@/hooks/useAnalyticsDrilldown";
import { exportDrilldown } from "@/services/analyticsService";
import { useAuth } from "@/state/auth";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  SparklesIcon,
} from "@/components/analytics/ChartIcons";
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

  const totalAmount = rows.reduce((s, r) => s + (r.loan_amount ?? 0), 0);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportDrilldown(
        { ...filter, metric_context: metricContext, limit: 5000, page: 1 },
        token ?? undefined,
      );
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
        <div className="drilldown-handle" aria-hidden />
        <header className="drilldown-header">
          <div className="drilldown-header-titles">
            <span className="drilldown-chip">
              <SparklesIcon width={12} height={12} />
              Drill-down
            </span>
            <h3>{title}</h3>
            <span className="drilldown-subtitle">
              <strong>{total.toLocaleString()}</strong>
              <span className="drilldown-subtitle-sep">loan{total === 1 ? "" : "s"}</span>
              {total > 0 ? (
                <>
                  <span className="drilldown-subtitle-sep">·</span>
                  <span className="drilldown-subtitle-amount">{formatCurrency(totalAmount)}</span>
                </>
              ) : null}
            </span>
          </div>
          <div className="drilldown-header-actions">
            <button
              type="button"
              className="drilldown-action drilldown-action--primary"
              onClick={handleExport}
              disabled={exporting || total === 0}
            >
              <DownloadIcon width={13} height={13} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="drilldown-action drilldown-action--ghost"
              onClick={onClose}
              aria-label="Close drilldown"
            >
              <CloseIcon width={13} height={13} />
              Close
            </button>
          </div>
        </header>

        {error ? (
          <div className="drilldown-empty-state">
            <h4>Couldn&apos;t load loans</h4>
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
              <span className="drilldown-page-info">
                Page <strong>{page}</strong> of <strong>{lastPage}</strong>
                <span className="drilldown-page-sep">·</span>
                <span className="drilldown-page-total">{total.toLocaleString()} total</span>
              </span>
              <div className="drilldown-pagination">
                <button
                  type="button"
                  className="drilldown-action drilldown-action--ghost"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  <ChevronLeftIcon width={12} height={12} />
                  Prev
                </button>
                <button
                  type="button"
                  className="drilldown-action drilldown-action--ghost"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage || isLoading}
                >
                  Next
                  <ChevronRightIcon width={12} height={12} />
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}