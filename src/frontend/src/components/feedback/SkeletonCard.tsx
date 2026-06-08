export function SkeletonCard() {
  return (
    <article className="metric-card skeleton-card" aria-label="Loading summary card">
      <span className="skeleton-line short" />
      <span className="skeleton-line large" />
      <span className="skeleton-line medium" />
    </article>
  );
}
