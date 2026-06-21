import { loanProgramLabels, loanStatusLabels, type LoanProgram, type LoanStatus } from "@/types/loan";
import { hasActiveFilters, usePipelineStore } from "@/state/pipelineStore";

const STATUS_OPTIONS: LoanStatus[] = [
  "new_draft",
  "submitted",
  "conditions_review",
  "approved_pending",
  "approved",
  "funded",
  "closed",
  "denied",
  "withdrawn",
  "cancelled",
];

const PROGRAM_OPTIONS: LoanProgram[] = [
  "dscr",
  "bank_statement",
  "asset_depletion",
  "interest_only",
  "jumbo_non_qm",
  "conventional",
  "other",
];

export function PipelineFilterPanel() {
  const store = usePipelineStore();
  const { filters } = store;
  const active = hasActiveFilters(filters);

  function toggleStatus(status: LoanStatus) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    store.setFilters({ statuses: next });
  }

  function toggleProgram(program: LoanProgram) {
    const next = filters.programs.includes(program)
      ? filters.programs.filter((p) => p !== program)
      : [...filters.programs, program];
    store.setFilters({ programs: next });
  }

  return (
    <>
      <div
        className="pipeline-filter-backdrop"
        onClick={() => store.setFilterPanelOpen(false)}
        aria-hidden
      />
      <div
        className="pipeline-filter-panel"
        role="complementary"
        aria-label="Pipeline filters"
      >
        <div className="pipeline-filter-header">
          <h3 className="pipeline-filter-title">Filters</h3>
          <div className="pipeline-filter-header-actions">
            {active && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => store.resetFilters()}
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              className="ghost-button pipeline-filter-close"
              onClick={() => store.setFilterPanelOpen(false)}
              aria-label="Close filters"
            >
              ×
            </button>
          </div>
        </div>

        <div className="pipeline-filter-body">
          <div className="filter-section">
            <p className="filter-section-label">Loan Status</p>
            <div className="filter-check-group">
              {STATUS_OPTIONS.map((status) => (
                <label key={status} className="filter-check-item">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                  />
                  {loanStatusLabels[status]}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-section-label">Product Type</p>
            <div className="filter-check-group">
              {PROGRAM_OPTIONS.map((program) => (
                <label key={program} className="filter-check-item">
                  <input
                    type="checkbox"
                    checked={filters.programs.includes(program)}
                    onChange={() => toggleProgram(program)}
                  />
                  {loanProgramLabels[program]}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-section-label">Loan Amount</p>
            <div className="filter-range">
              <input
                type="number"
                placeholder="Min ($)"
                className="filter-range-input"
                value={filters.minAmount}
                onChange={(e) => store.setFilters({ minAmount: e.target.value })}
                min={0}
                step={50000}
              />
              <span className="filter-range-sep">—</span>
              <input
                type="number"
                placeholder="Max ($)"
                className="filter-range-input"
                value={filters.maxAmount}
                onChange={(e) => store.setFilters({ maxAmount: e.target.value })}
                min={0}
                step={50000}
              />
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-section-label">Workflow</p>
            <div className="filter-check-group">
              <label className="filter-check-item">
                <input
                  type="checkbox"
                  checked={filters.actionNeeded}
                  onChange={() =>
                    store.setFilters({ actionNeeded: !filters.actionNeeded })
                  }
                />
                Action Needed
              </label>
              <label className="filter-check-item">
                <input
                  type="checkbox"
                  checked={filters.conditionsOutstanding}
                  onChange={() =>
                    store.setFilters({
                      conditionsOutstanding: !filters.conditionsOutstanding,
                    })
                  }
                />
                Conditions Outstanding
              </label>
            </div>
          </div>
        </div>

        <div className="pipeline-filter-footer">
          <button
            type="button"
            className="primary-button"
            onClick={() => store.setFilterPanelOpen(false)}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
