// KpiStrip — horizontal scrollable row of MetricCards. Layout-preserving
// skeletons match the expected card sizes so the page doesn't shift while data
// loads.

import { MetricCard } from "@/components/analytics/MetricCard";
import { SkeletonCard } from "@/components/feedback/SkeletonCard";
import type { KpiCard as KpiCardType } from "@/types/analytics";

type KpiStripProps = {
  kpis: KpiCardType[];
  loading?: boolean;
  onDrilldownClick?: (metricKey: string) => void;
};

export function KpiStrip({ kpis, loading = false, onDrilldownClick }: KpiStripProps) {
  if (loading) {
    return (
      <section className="metric-grid kpi-strip" aria-label="Loading KPIs">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
    );
  }

  return (
    <section className="metric-grid kpi-strip" aria-label="Pipeline KPIs">
      {kpis.map((kpi) => (
        <MetricCard key={kpi.id} kpi={kpi} onDrilldownClick={onDrilldownClick} />
      ))}
    </section>
  );
}