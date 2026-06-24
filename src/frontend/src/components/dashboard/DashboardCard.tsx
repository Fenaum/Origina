import Link from "next/link";
import type { DashboardMetric } from "@/types/dashboard";

export function DashboardCard({ metric }: { metric: DashboardMetric }) {
  const card = (
    <article className={`metric-card fade-slide-in ${metric.tone ?? "default"}`}>
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <span>{metric.detail}</span>
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
