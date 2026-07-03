import type { StatusItem } from "@/types/dashboard";

type StatusListProps = {
  title: string;
  /** Short helper shown to the right of the title. */
  hint?: string;
  /** Optional link target for the panel heading (renders as "View all →"). */
  viewAllHref?: string;
  items: StatusItem[];
};

export function StatusList({ title, hint, viewAllHref, items }: StatusListProps) {
  return (
    <section className="panel fade-slide-in dashboard-status-panel">
      <div className="panel-heading">
        <div className="panel-heading-main">
          <h3>{title}</h3>
          {hint ? <span className="panel-heading-hint">{hint}</span> : null}
        </div>
        {viewAllHref ? (
          <a className="panel-heading-link" href={viewAllHref}>
            View all
            <svg viewBox="0 0 12 12" width={11} height={11} aria-hidden focusable={false}>
              <path
                d="M3 6h6m-2.5-2.5L9 6 6.5 8.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : null}
      </div>
      <ul className="status-list" role="list">
        {items.map((item, index) => {
          const emphasis = item.emphasis ?? "default";
          const monogram = (item.monogram ?? item.label.slice(0, 2)).toUpperCase();
          return (
            <li
              className={`status-row status-row--${emphasis} dashboard-stagger`}
              key={item.label}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="status-row-main">
                <span className={`status-row-monogram status-row-monogram--${emphasis}`} aria-hidden>
                  {monogram}
                </span>
                <div className="status-row-text">
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </div>
              </div>
              <div className="status-row-aside">
                <p>{item.value}</p>
                <span className={`status-row-pip status-row-pip--${emphasis}`} aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}