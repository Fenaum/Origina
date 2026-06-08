import type { StatusItem } from "@/types/dashboard";

type StatusListProps = {
  title: string;
  items: StatusItem[];
};

export function StatusList({ title, items }: StatusListProps) {
  return (
    <section className="panel fade-slide-in">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>
      <div className="status-list">
        {items.map((item) => (
          <div className="status-row" key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.meta}</span>
            </div>
            <p>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
