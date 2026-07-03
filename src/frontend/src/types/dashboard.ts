export type DashboardTone = "default" | "success" | "warning" | "info" | "accent";

export type DashboardTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: DashboardTone;
  href?: string;
  icon?: React.ReactNode;
  trend?: DashboardTrend;
  /** Optional sparkline points (0-1 normalized, left to right). */
  spark?: number[];
};

export type StatusItem = {
  label: string;
  value: string;
  meta: string;
  /** Visual emphasis: drives the dot color + glow. */
  emphasis?: "default" | "warning" | "success" | "info";
  /** Optional monogram shown in the avatar bubble. */
  monogram?: string;
};