import Link from "next/link";
import type { DashboardMetric } from "@/types/dashboard";

type DashboardCardProps = { metric: DashboardMetric };

// Map a normalized spark array (0-1) to an SVG path that fits the card's
// sparkline area. Y axis is inverted because SVG y grows downward.
function sparklinePath(points: number[]): string {
  if (points.length < 2) return "";
  const w = 100;
  const h = 28;
  const step = w / (points.length - 1);
  return points
    .map((value, index) => {
      const x = index * step;
      // Pad the top/bottom by 10% so the line never touches the edges.
      const y = h - (value * (h - 6) + 3);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function sparklineFillPath(points: number[]): string {
  if (points.length < 2) return "";
  const w = 100;
  const h = 28;
  const step = w / (points.length - 1);
  const linePath = points
    .map((value, index) => {
      const x = index * step;
      const y = h - (value * (h - 6) + 3);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return `${linePath} L${w} ${h} L0 ${h} Z`;
}

function TrendIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") {
    return (
      <svg viewBox="0 0 12 12" width={11} height={11} aria-hidden focusable={false}>
        <path d="M2 8.5 6 4l4 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (direction === "down") {
    return (
      <svg viewBox="0 0 12 12" width={11} height={11} aria-hidden focusable={false}>
        <path d="M2 3.5 6 8l4-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" width={11} height={11} aria-hidden focusable={false}>
      <path d="M2.5 6h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardCard({ metric }: DashboardCardProps) {
  const tone = metric.tone ?? "default";
  const hasSparkline = !!metric.spark && metric.spark.length > 1;
  const sparklineId = `spark-${metric.label.replace(/\s+/g, "-").toLowerCase()}`;

  const card = (
    <article className={`metric-card metric-card--${tone} fade-slide-in`}>
      <div className="metric-card-top">
        {metric.icon ? (
          <span className="metric-card-icon" aria-hidden>
            {metric.icon}
          </span>
        ) : null}
        {metric.trend ? (
          <span
            className={`metric-card-trend metric-card-trend--${metric.trend.direction}`}
            aria-label={metric.trend.label}
          >
            <TrendIcon direction={metric.trend.direction} />
            <span>{metric.trend.label}</span>
          </span>
        ) : null}
      </div>

      <p className="metric-card-label">{metric.label}</p>
      <strong className="metric-card-value">{metric.value}</strong>
      <span className="metric-card-detail">{metric.detail}</span>

      {hasSparkline ? (
        <svg
          className="metric-card-spark"
          viewBox="0 0 100 28"
          preserveAspectRatio="none"
          aria-hidden
          focusable={false}
        >
          <defs>
            <linearGradient id={`${sparklineId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={sparklineFillPath(metric.spark!)} fill={`url(#${sparklineId}-fill)`} />
          <path
            d={sparklinePath(metric.spark!)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </article>
  );

  if (metric.href) {
    return (
      <Link href={metric.href} className="metric-card-link">
        {card}
      </Link>
    );
  }

  return card;
}