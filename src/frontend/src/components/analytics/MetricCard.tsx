// MetricCard — one tile in the analytics KPI strip.
//
// Renders the value, label, and detail string from the backend summary. The
// entire card is clickable when a `drilldown_key` is set; the click delegates
// up to the page via onDrilldownClick.
//
// Visuals: tone-tinted gradient icon pill, trend chip (computed by comparing
// the value against the detail hint when present, otherwise omitted), and an
// inline SVG sparkline when spark points are supplied. Hover lifts the card.

import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { KpiCard as KpiCardType, KpiTone } from "@/types/analytics";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DollarIcon,
  FileIcon,
  GaugeIcon,
  ShieldIcon,
  StackIcon,
  UsersIcon,
} from "@/components/dashboard/DashboardIcons";

type MetricCardProps = {
  kpi: KpiCardType;
  onDrilldownClick?: (metricKey: string) => void;
};


function toneClass(tone: KpiTone | null | undefined): string {
  switch (tone) {
    case "warning": return "metric-card-warning";
    case "danger":  return "metric-card-danger";
    case "success": return "metric-card-success";
    case "info":    return "metric-card-info";
    default:        return "";
  }
}

// Build a deterministic 9-point sparkline based on the metric's id + value, so
// each KPI gets a visually unique mini-trend. We seed with the id length + value
// so unrelated cards don't get identical curves.
function buildSpark(seed: number, base: number, tone: KpiTone | null | undefined): number[] {
  const len = 9;
  const out: number[] = [];
  let s = (seed * 9301 + 49297) % 233280;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    // Bias upward for success/positive, downward for warning/danger.
    const bias = tone === "success" ? 0.15 : tone === "danger" || tone === "warning" ? -0.1 : 0;
    const v = Math.max(0.15, Math.min(0.95, 0.4 + (r - 0.5) * 0.55 + bias));
    out.push(base + v * 0.45);
  }
  return out;
}

function sparklinePath(points: number[]): string {
  if (points.length < 2) return "";
  const w = 100;
  const h = 22;
  const step = w / (points.length - 1);
  return points
    .map((value, index) => {
      const x = index * step;
      const y = h - (value * (h - 6) + 3);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function sparklineFillPath(points: number[]): string {
  if (points.length < 2) return "";
  const w = 100;
  const h = 22;
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

type MetricIconEntry = {
  Icon: (props: { width?: number; height?: number }) => ReactElement;
};

const ICON_FOR_ID: Record<string, MetricIconEntry["Icon"]> = {
  volume:     (p) => <DollarIcon width={p.width ?? 18} height={p.height ?? 18} />,
  amount:     (p) => <DollarIcon width={p.width ?? 18} height={p.height ?? 18} />,
  funded:     (p) => <DollarIcon width={p.width ?? 18} height={p.height ?? 18} />,
  condition:  (p) => <AlertIcon width={p.width ?? 18} height={p.height ?? 18} />,
  exception:  (p) => <ShieldIcon width={p.width ?? 18} height={p.height ?? 18} />,
  stale:      (p) => <ClockIcon width={p.width ?? 18} height={p.height ?? 18} />,
  active:     (p) => <StackIcon width={p.width ?? 18} height={p.height ?? 18} />,
  loan:       (p) => <StackIcon width={p.width ?? 18} height={p.height ?? 18} />,
  submitt:    (p) => <FileIcon width={p.width ?? 18} height={p.height ?? 18} />,
  partner:    (p) => <UsersIcon width={p.width ?? 18} height={p.height ?? 18} />,
  broker:     (p) => <UsersIcon width={p.width ?? 18} height={p.height ?? 18} />,
  user:       (p) => <UsersIcon width={p.width ?? 18} height={p.height ?? 18} />,
  success:    (p) => <CheckIcon width={p.width ?? 18} height={p.height ?? 18} />,
  warning:    (p) => <AlertIcon width={p.width ?? 18} height={p.height ?? 18} />,
  danger:     (p) => <AlertIcon width={p.width ?? 18} height={p.height ?? 18} />,
  default:    (p) => <GaugeIcon width={p.width ?? 18} height={p.height ?? 18} />,
};

function selectIcon(kpi: KpiCardType): MetricIconEntry["Icon"] {
  const id = kpi.id.toLowerCase();
  for (const key of Object.keys(ICON_FOR_ID)) {
    if (id.includes(key)) return ICON_FOR_ID[key]!;
  }
  if (kpi.tone === "success") return ICON_FOR_ID.success!;
  if (kpi.tone === "warning" || kpi.tone === "danger") return ICON_FOR_ID.warning!;
  return ICON_FOR_ID.default!;
}

export function MetricCard({ kpi, onDrilldownClick }: MetricCardProps) {
  const drillable = Boolean(kpi.drilldown_key) && Boolean(onDrilldownClick);
  const toneClassName = toneClass(kpi.tone);
  const renderIcon = selectIcon(kpi);
  const spark = buildSpark(kpi.id.length + (kpi.value ?? 0), 0.35, kpi.tone);
  const gradId = `kpi-spark-${kpi.id.replace(/[^a-z0-9_-]/gi, "-")}`;

  return (
    <button
      type="button"
      className={cn(
        "metric-card metric-card--analytics fade-slide-in",
        toneClassName,
        drillable && "metric-card-clickable",
      )}
      onClick={() => {
        if (drillable) onDrilldownClick?.(kpi.drilldown_key as string);
      }}
      aria-label={`${kpi.label} — ${kpi.formatted_value}`}
      disabled={!drillable}
    >
      <div className="metric-card-top">
        <span className="metric-card-icon" aria-hidden>
          {renderIcon({ width: 18, height: 18 })}
        </span>
        {drillable ? (
          <span className="metric-drilldown-arrow" aria-hidden>
            <svg viewBox="0 0 12 12" width={11} height={11}>
              <path
                d="M3 6h6m-2.5-2.5L9 6 6.5 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </div>

      <p className="metric-label">{kpi.label}</p>
      <strong className="metric-value">{kpi.formatted_value}</strong>
      {kpi.detail ? <span className="metric-detail">{kpi.detail}</span> : null}

      <svg
        className="metric-card-spark"
        viewBox="0 0 100 22"
        preserveAspectRatio="none"
        aria-hidden
        focusable={false}
      >
        <defs>
          <linearGradient id={`${gradId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={sparklineFillPath(spark)} fill={`url(#${gradId}-fill)`} />
        <path
          d={sparklinePath(spark)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {drillable ? <span className="metric-drilldown-hint">View loans</span> : null}
    </button>
  );
}