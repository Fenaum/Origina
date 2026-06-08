import { ChartSkeleton } from "@/components/feedback/ChartSkeleton";
import { SkeletonCard } from "@/components/feedback/SkeletonCard";
import { TableSkeleton } from "@/components/feedback/TableSkeleton";

export function PipelinePageSkeleton() {
  return (
    <>
      <section className="metric-grid pipeline-kpi-grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
      <section className="chart-grid">
        <ChartSkeleton title="Loading loan count by status" />
        <ChartSkeleton title="Loading volume by status" />
        <ChartSkeleton title="Loading channel mix" />
        <ChartSkeleton title="Loading action summary" />
        <div className="chart-grid-wide">
          <ChartSkeleton title="Loading monthly submissions" />
        </div>
      </section>
      <TableSkeleton rows={6} />
    </>
  );
}
