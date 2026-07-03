// ChartCard — wraps a Recharts chart with a click → drilldown handler.
//
// The wrapping <button> is what receives the click. Individual chart bars can
// supply their own onClick to drill into a specific dimension (e.g. clicking
// "Submitted" drills down with status=submitted). The onBarClick prop is the
// helper for that pattern.
//
// isEmpty is determined by the parent based on the underlying data array.
// Empty state shows a "No data" message instead of an empty Recharts render.
//
// Visuals: gradient accent strip, title icon, optional chart-type pill badge
// (bar / pie / line), and a soft hover lift when the card is clickable.

import { type ReactNode } from "react";
import {
  BarChartIcon,
  GaugeIcon,
  LineChartIcon,
  PieChartIcon,
  type IconComponent,
} from "@/components/analytics/ChartIcons";

type ChartType = "bar" | "pie" | "line" | "donut";

export type ChartCardProps = {
  title: string;
  description?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClick?: () => void;
  children: ReactNode;
  /** Visual treatment of the panel header — defaults to a generic gauge. */
  chartType?: ChartType;
};

export function ChartCard({
  title,
  description,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  onClick,
  children,
  chartType = "bar",
}: ChartCardProps) {
  const clickable = Boolean(onClick);
  const { Icon, label } = chartTypeMeta(chartType);

  return (
    <section
      className={`panel chart-panel fade-slide-in ${clickable ? "chart-panel-clickable" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={clickable ? `${title} — click to view loans` : title}
    >
      <div className="chart-panel-accent" aria-hidden />
      <div className="panel-heading chart-panel-heading">
        <div className="chart-panel-title-block">
          <span className="chart-panel-icon" aria-hidden>
            <Icon width={14} height={14} />
          </span>
          <div className="chart-panel-titles">
            <h3>{title}</h3>
            {description ? <span>{description}</span> : null}
          </div>
        </div>
        <div className="chart-panel-meta">
          <span className="chart-panel-type-pill" aria-label={`Chart type: ${label}`}>
            {label}
          </span>
          {clickable ? <span className="chart-drilldown-hint">View loans →</span> : null}
        </div>
      </div>

      {isEmpty ? (
        <div className="inline-empty-state">
          <h4>{emptyTitle ?? "No data"}</h4>
          <p>{emptyDescription ?? "Loan data will appear here once files are available."}</p>
        </div>
      ) : (
        <div className="chart-body">{children}</div>
      )}
    </section>
  );
}

function chartTypeMeta(type: ChartType): { Icon: IconComponent; label: string } {
  switch (type) {
    case "pie":
    case "donut":
      return { Icon: PieChartIcon, label: "Donut" };
    case "line":
      return { Icon: LineChartIcon, label: "Trend" };
    case "bar":
      return { Icon: BarChartIcon, label: "Bar" };
    default:
      return { Icon: GaugeIcon, label: "Chart" };
  }
}