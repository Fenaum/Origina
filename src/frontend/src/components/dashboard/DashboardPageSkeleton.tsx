import { SkeletonCard } from "@/components/feedback/SkeletonCard";

export function DashboardPageSkeleton() {
  return (
    <>
      <section className="metric-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
      <section className="panel fade-in" aria-label="Loading dashboard work queue">
        <div className="panel-heading">
          <span className="skeleton-line heading" />
        </div>
        <div className="status-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="status-row" key={index}>
              <div>
                <span className="skeleton-line medium" />
                <span className="skeleton-line short" />
              </div>
              <span className="skeleton-line tiny" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
