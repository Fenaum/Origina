import type { DashboardMetric } from "@/types/dashboard";

export function DashboardCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className={`metric-card fade-slide-in ${metric.tone ?? "default"}`}>
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <span>{metric.detail}</span>
    </article>
  );
}
