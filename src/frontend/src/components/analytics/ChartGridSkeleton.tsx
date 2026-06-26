// ChartGridSkeleton — layout-preserving loading state for the chart grid.
// Matches the 2-column structure of the live chart grid so the page doesn't
// jump when real data arrives.

import { ChartSkeleton } from "@/components/feedback/ChartSkeleton";

export function ChartGridSkeleton() {
  return (
    <section className="chart-grid" aria-label="Loading charts">
      <ChartSkeleton title="Status distribution" />
      <ChartSkeleton title="Volume by status" />
      <ChartSkeleton title="Channel mix" />
      <ChartSkeleton title="Aging by status" />
      <div className="chart-grid-wide">
        <ChartSkeleton title="Monthly submissions" />
      </div>
    </section>
  );
}