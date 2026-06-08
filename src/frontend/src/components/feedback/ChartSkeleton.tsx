export function ChartSkeleton({ title = "Loading chart" }: { title?: string }) {
  return (
    <section className="panel chart-panel fade-in" aria-label={title}>
      <div className="panel-heading">
        <span className="skeleton-line heading" />
        <span className="skeleton-line tiny" />
      </div>
      <div className="chart-skeleton">
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
