type ChartPanelProps = {
  title: string;
  description: string;
  isEmpty?: boolean;
  children: React.ReactNode;
};

export function ChartPanel({
  title,
  description,
  isEmpty = false,
  children,
}: ChartPanelProps) {
  return (
    <section className="panel chart-panel fade-slide-in">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <span>{description}</span>
        </div>
      </div>
      {isEmpty ? (
        <div className="inline-empty-state">
          <h4>No chart data</h4>
          <p>Loan data will appear here once files are available.</p>
        </div>
      ) : (
        <div className="chart-body">{children}</div>
      )}
    </section>
  );
}
