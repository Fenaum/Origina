import type { KpiCard as KpiCardType } from "@/types/analytics";

type Props = {
  kpi: KpiCardType;
  /**
   * Optional click handler. Pass-through only — the manager dashboard does
   * not own drilldown routing; the parent decides where a click lands.
   */
  onClick?: () => void;
};

function toneClass(tone: KpiCardType["tone"] | null | undefined): string {
  switch (tone) {
    case "success":
      return "team-kpi-card--success";
    case "warning":
      return "team-kpi-card--warning";
    case "danger":
      return "team-kpi-card--danger";
    case "info":
      return "team-kpi-card--info";
    default:
      return "team-kpi-card--neutral";
  }
}

/**
 * TeamKPICard — one KPI tile for the manager dashboard. Renders a label,
 * a formatted value, and a one-line detail. Tone colors the border.
 *
 * Pulled out of RoleDashboard so the manager view can compose several
 * cards without baking in the analytics response shape.
 */
export function TeamKPICard({ kpi, onClick }: Props) {
  return (
    <button
      type="button"
      className={`team-kpi-card ${toneClass(kpi.tone)}`}
      onClick={onClick}
      data-testid={`team-kpi-card-${kpi.id}`}
    >
      <span className="team-kpi-card-label">{kpi.label}</span>
      <strong className="team-kpi-card-value">{kpi.formatted_value}</strong>
      {kpi.detail && <span className="team-kpi-card-detail">{kpi.detail}</span>}
    </button>
  );
}
