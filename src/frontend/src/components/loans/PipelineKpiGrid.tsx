import type { PipelineKpi } from "@/types/loan";

export function PipelineKpiGrid({ kpis }: { kpis: PipelineKpi[] }) {
  return (
    <section className="metric-grid pipeline-kpi-grid" aria-label="Pipeline KPIs">
      {kpis.map((kpi) => (
        <article className="metric-card fade-slide-in" key={kpi.label}>
          <p>{kpi.label}</p>
          <strong>{kpi.value}</strong>
          <span>{kpi.detail}</span>
        </article>
      ))}
    </section>
  );
}
