// ChartCard — wraps a Recharts chart with a click → drilldown handler.
//
// The wrapping <button> is what receives the click. Individual chart bars can
// supply their own onClick to drill into a specific dimension (e.g. clicking
// "Submitted" drills down with status=submitted). The onBarClick prop is the
// helper for that pattern.
//
// isEmpty is determined by the parent based on the underlying data array.
// Empty state shows a "No data" message instead of an empty Recharts render.

import { type ReactNode } from "react";
import { ChartPanel } from "@/components/charts/ChartPanel";

type ChartCardProps = {
  title: string;
  description?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClick?: () => void;
  children: ReactNode;
};

export function ChartCard({
  title,
  description,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  onClick,
  children,
}: ChartCardProps) {
  const clickable = Boolean(onClick);

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
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {description ? <span>{description}</span> : null}
        </div>
        {clickable ? <span className="chart-drilldown-hint">View loans →</span> : null}
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