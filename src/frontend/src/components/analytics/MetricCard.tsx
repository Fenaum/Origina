// MetricCard — one tile in the analytics KPI strip.
//
// Renders the value, label, and detail string from the backend summary, and
// turns the entire card into a clickable button when a `drilldown_key` is set.
// The click delegates up to the page via onDrilldownClick, which is responsible
// for calling the drilldown endpoint and opening the drilldown panel.

import { cn } from "@/lib/utils";
import type { KpiCard as KpiCardType, KpiTone } from "@/types/analytics";

type MetricCardProps = {
  kpi: KpiCardType;
  onDrilldownClick?: (metricKey: string) => void;
};

export function MetricCard({ kpi, onDrilldownClick }: MetricCardProps) {
  const drillable = Boolean(kpi.drilldown_key) && Boolean(onDrilldownClick);

  const toneClass = toneToClass(kpi.tone ?? null);

  return (
    <button
      type="button"
      className={cn(
        "metric-card fade-slide-in",
        toneClass,
        drillable && "metric-card-clickable",
      )}
      onClick={() => {
        if (drillable) onDrilldownClick?.(kpi.drilldown_key as string);
      }}
      aria-label={`${kpi.label} — ${kpi.formatted_value}`}
      disabled={!drillable}
    >
      <p className="metric-label">{kpi.label}</p>
      <strong className="metric-value">{kpi.formatted_value}</strong>
      {kpi.detail ? <span className="metric-detail">{kpi.detail}</span> : null}
      {drillable ? <span className="metric-drilldown-hint">View loans →</span> : null}
    </button>
  );
}

function toneToClass(tone: KpiTone | null): string {
  switch (tone) {
    case "warning": return "metric-card-warning";
    case "danger":  return "metric-card-danger";
    case "success": return "metric-card-success";
    case "info":    return "metric-card-info";
    default:        return "";
  }
}