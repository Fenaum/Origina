import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardMetric } from "@/types/dashboard";

export function DashboardGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="metric-grid" aria-label="Dashboard summary">
      {metrics.map((metric) => (
        <DashboardCard key={metric.label} metric={metric} />
      ))}
    </section>
  );
}
