import { SkeletonCard } from "@/components/feedback/SkeletonCard";

export function DashboardPageSkeleton() {
  return (
    <>
      <section className="metric-grid" aria-label="Loading dashboard summary">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
      <section className="panel dashboard-status-panel fade-in" aria-label="Loading work queue">
        <div className="panel-heading">
          <div className="panel-heading-main">
            <span className="skeleton-line heading" />
            <span className="skeleton-line short" />
          </div>
        </div>
        <ul className="status-list" role="list">
          {Array.from({ length: 3 }).map((_, index) => (
            <li className="status-row" key={index}>
              <div className="status-row-main">
                <span className="skeleton-circle" />
                <div className="status-row-text">
                  <span className="skeleton-line medium" />
                  <span className="skeleton-line short" />
                </div>
              </div>
              <span className="skeleton-line tiny" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}