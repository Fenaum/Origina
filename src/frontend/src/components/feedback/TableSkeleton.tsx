export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="panel fade-in" aria-label="Loading table">
      <div className="panel-heading">
        <span className="skeleton-line heading" />
        <span className="skeleton-line tiny" />
      </div>
      <div className="table-skeleton">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="table-skeleton-row" key={index}>
            <span className="skeleton-line medium" />
            <span className="skeleton-line short" />
            <span className="skeleton-line medium" />
            <span className="skeleton-line short" />
          </div>
        ))}
      </div>
    </section>
  );
}
