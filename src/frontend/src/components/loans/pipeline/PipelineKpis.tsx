import type { LoanSummary } from "@/types/loan";
import { usePipelineStore } from "@/state/pipelineStore";
import type { PipelineFilters, SortField } from "@/state/pipelineStore";

type KpiDef = {
  id: string;
  label: string;
  getValue: (loans: LoanSummary[]) => number;
  getDetail: (loans: LoanSummary[], value: number) => string;
  filterPatch: Partial<PipelineFilters>;
  sortField: SortField;
  sortDir: "asc" | "desc";
  variant: "default" | "warning" | "success" | "muted";
};

const KPI_DEFS: KpiDef[] = [
  {
    id: "active",
    label: "Active Loans",
    getValue: (loans) =>
      loans.filter(
        (l) =>
          !["funded", "closed", "archived", "cancelled", "denied", "withdrawn"].includes(
            l.status,
          ),
      ).length,
    getDetail: (loans) => `${loans.length} total in pipeline`,
    filterPatch: {},
    sortField: "updatedAt",
    sortDir: "desc",
    variant: "default",
  },
  {
    id: "conditions",
    label: "Conditions Outstanding",
    getValue: (loans) => loans.filter((l) => l.conditionsOpen > 0).length,
    getDetail: (loans) =>
      `${loans.reduce((s, l) => s + l.conditionsOpen, 0)} open conditions total`,
    filterPatch: { conditionsOutstanding: true },
    sortField: "conditionsOpen",
    sortDir: "desc",
    variant: "warning",
  },
  {
    id: "action",
    label: "Action Needed",
    getValue: (loans) => loans.filter((l) => l.actionsNeeded > 0).length,
    getDetail: (_, v) => `${v} loan${v !== 1 ? "s" : ""} requiring attention`,
    filterPatch: { actionNeeded: true },
    sortField: "actionsNeeded",
    sortDir: "desc",
    variant: "warning",
  },
  {
    id: "submitted",
    label: "Submitted This Month",
    getValue: (loans) => {
      const now = new Date();
      return loans.filter((l) => {
        if (!l.submittedAt) return false;
        const d = new Date(l.submittedAt);
        return (
          d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        );
      }).length;
    },
    getDetail: () => "New submissions this month",
    filterPatch: { statuses: ["submitted"] },
    sortField: "submittedAt",
    sortDir: "desc",
    variant: "default",
  },
  {
    id: "approved",
    label: "Approved",
    getValue: (loans) =>
      loans.filter((l) =>
        ["approved", "approved_pending"].includes(l.status),
      ).length,
    getDetail: () => "Ready to proceed to closing",
    filterPatch: { statuses: ["approved", "approved_pending"] },
    sortField: "updatedAt",
    sortDir: "desc",
    variant: "success",
  },
];

export function PipelineKpis({ loans }: { loans: LoanSummary[] }) {
  const { applyFilterPreset, resetFilters, activeViewId, filters } = usePipelineStore();

  function handleClick(def: KpiDef) {
    if (Object.keys(def.filterPatch).length === 0) {
      resetFilters();
    } else {
      applyFilterPreset(def.filterPatch, def.sortField, def.sortDir);
    }
  }

  function isActive(def: KpiDef): boolean {
    if (def.id === "active") return activeViewId === "all-active";
    if (def.id === "conditions") return filters.conditionsOutstanding && !filters.actionNeeded && filters.statuses.length === 0 && filters.programs.length === 0;
    if (def.id === "action") return filters.actionNeeded && !filters.conditionsOutstanding && filters.statuses.length === 0 && filters.programs.length === 0;
    if (def.id === "submitted") return filters.statuses.length === 1 && filters.statuses[0] === "submitted";
    if (def.id === "approved") return filters.statuses.length === 2 && filters.statuses.includes("approved") && filters.statuses.includes("approved_pending");
    return false;
  }

  return (
    <div className="pipeline-kpis" aria-label="Pipeline KPIs">
      {KPI_DEFS.map((def) => {
        const value = def.getValue(loans);
        const detail = def.getDetail(loans, value);
        const active = isActive(def);
        return (
          <button
            key={def.id}
            type="button"
            className={`pipeline-kpi-card pipeline-kpi-card--${def.variant}${active ? " pipeline-kpi-card--active" : ""}`}
            onClick={() => handleClick(def)}
          >
            <span className="pipeline-kpi-value">{value}</span>
            <span className="pipeline-kpi-label">{def.label}</span>
            <span className="pipeline-kpi-detail">{detail}</span>
          </button>
        );
      })}
    </div>
  );
}
