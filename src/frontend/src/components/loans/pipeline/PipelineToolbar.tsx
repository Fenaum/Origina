import { useRef, useState } from "react";
import {
  ALL_COLUMN_DEFS,
  DEFAULT_COLUMNS,
  getAllViews,
  hasActiveFilters,
  usePipelineStore,
  type ColumnId,
} from "@/state/pipelineStore";
import { loanProgramLabels, loanStatusLabels, type LoanSummary } from "@/types/loan";

type Props = {
  totalCount: number;
  exportLoans: LoanSummary[];
  onRefresh: () => void;
};

function exportCsv(loans: LoanSummary[]) {
  const headers = [
    "Loan Number", "Borrower", "Status", "Product", "Amount",
    "Channel", "State", "File Owner", "Conditions Open", "Actions Needed",
    "Submitted", "Updated",
  ];
  const rows = loans.map((l) => [
    l.loanNumber,
    l.borrowerName,
    loanStatusLabels[l.status],
    loanProgramLabels[l.loanProgram] ?? l.loanProgram,
    String(l.loanAmount),
    l.channel,
    l.propertyState,
    l.owner,
    String(l.conditionsOpen),
    String(l.actionsNeeded),
    l.submittedAt ?? "",
    l.updatedAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PipelineToolbar({ totalCount, exportLoans, onRefresh }: Props) {
  const store = usePipelineStore();
  const { builtIn: builtInViews, user: userViews } = getAllViews(store.userViews);
  const filtersActive = hasActiveFilters(store.filters);
  const filteredCount = exportLoans.length;

  const [viewsOpen, setViewsOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [savePrompt, setSavePrompt] = useState(false);
  const [saveName, setSaveName] = useState("");

  const viewsRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);

  const activeView = [...builtInViews, ...userViews].find(
    (v) => v.id === store.activeViewId,
  );

  function handleSaveView(e: React.FormEvent) {
    e.preventDefault();
    if (!saveName.trim()) return;
    store.saveView(saveName);
    setSaveName("");
    setSavePrompt(false);
    setViewsOpen(false);
  }

  function moveColumn(id: ColumnId, dir: -1 | 1) {
    const cols = [...store.columns];
    const idx = cols.indexOf(id);
    if (idx === -1) return;
    const next = idx + dir;
    if (next < 0 || next >= cols.length) return;
    [cols[idx], cols[next]] = [cols[next]!, cols[idx]!];
    store.setColumns(cols);
  }

  function toggleColumn(id: ColumnId) {
    if (store.columns.includes(id)) {
      if (store.columns.length <= 2) return;
      store.setColumns(store.columns.filter((c) => c !== id));
    } else {
      store.setColumns([...store.columns, id]);
    }
  }

  return (
    <div className="pipeline-toolbar">
      <div className="pipeline-toolbar-left">
        <div className="pipeline-search-wrap">
          <span className="pipeline-search-icon" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            placeholder="Search borrower, loan number, owner…"
            className="pipeline-search-input"
            value={store.filters.search}
            onChange={(e) => store.setFilters({ search: e.target.value })}
            aria-label="Search pipeline"
          />
          {store.filters.search && (
            <button
              type="button"
              className="pipeline-search-clear"
              onClick={() => store.setFilters({ search: "" })}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <span className="pipeline-result-count">
          {filteredCount === totalCount
            ? `${totalCount} loans`
            : `${filteredCount} of ${totalCount} loans`}
        </span>
      </div>

      <div className="pipeline-toolbar-right">
        {/* Saved Views */}
        <div className="pipeline-dropdown-wrap" ref={viewsRef}>
          <button
            type="button"
            className={`toolbar-btn${store.activeViewId ? " toolbar-btn-active" : ""}`}
            onClick={() => {
              setViewsOpen((v) => !v);
              setColsOpen(false);
            }}
            aria-expanded={viewsOpen}
            aria-haspopup="menu"
          >
            {activeView ? activeView.label : "Views"}
            <span className="toolbar-chevron" aria-hidden>
              {viewsOpen ? "▴" : "▾"}
            </span>
          </button>

          {viewsOpen && (
            <div className="pipeline-dropdown" role="menu">
              <div className="pipeline-dropdown-section">
                <p className="pipeline-dropdown-group-label">Default Views</p>
                {builtInViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    role="menuitem"
                    className={`pipeline-dropdown-item${store.activeViewId === view.id ? " active" : ""}`}
                    onClick={() => {
                      store.applyView(view);
                      setViewsOpen(false);
                    }}
                  >
                    <span>{view.label}</span>
                    {store.activeViewId === view.id && (
                      <span className="view-check" aria-hidden>
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {userViews.length > 0 && (
                <div className="pipeline-dropdown-section">
                  <p className="pipeline-dropdown-group-label">My Views</p>
                  {userViews.map((view) => (
                    <div key={view.id} className="pipeline-dropdown-item-row">
                      <button
                        type="button"
                        role="menuitem"
                        className={`pipeline-dropdown-item pipeline-dropdown-item--grow${store.activeViewId === view.id ? " active" : ""}`}
                        onClick={() => {
                          store.applyView(view);
                          setViewsOpen(false);
                        }}
                      >
                        <span>{view.label}</span>
                        {store.activeViewId === view.id && (
                          <span className="view-check" aria-hidden>
                            ✓
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pipeline-view-delete"
                        onClick={() => store.deleteView(view.id)}
                        aria-label={`Delete view ${view.label}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pipeline-dropdown-footer">
                {!savePrompt ? (
                  <button
                    type="button"
                    className="pipeline-dropdown-item pipeline-save-trigger"
                    onClick={() => setSavePrompt(true)}
                  >
                    + Save current view
                  </button>
                ) : (
                  <form onSubmit={handleSaveView} className="pipeline-save-form">
                    <input
                      autoFocus
                      type="text"
                      placeholder="View name…"
                      className="pipeline-save-input"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="pipeline-save-confirm"
                      disabled={!saveName.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="pipeline-save-cancel"
                      onClick={() => {
                        setSavePrompt(false);
                        setSaveName("");
                      }}
                    >
                      ×
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <button
          type="button"
          className={`toolbar-btn${filtersActive ? " toolbar-btn-filtered" : ""}${store.filterPanelOpen ? " toolbar-btn-active" : ""}`}
          onClick={() => store.setFilterPanelOpen(!store.filterPanelOpen)}
        >
          Filters
          {filtersActive && (
            <span className="toolbar-filter-dot" aria-label="Filters active" />
          )}
        </button>

        {/* Columns */}
        <div className="pipeline-dropdown-wrap" ref={colsRef}>
          <button
            type="button"
            className={`toolbar-btn${colsOpen ? " toolbar-btn-active" : ""}`}
            onClick={() => {
              setColsOpen((v) => !v);
              setViewsOpen(false);
            }}
            aria-expanded={colsOpen}
            aria-haspopup="menu"
          >
            Columns
          </button>

          {colsOpen && (
            <div className="pipeline-dropdown pipeline-cols-dropdown" role="menu">
              <div className="pipeline-dropdown-section">
                <div className="pipeline-cols-header">
                  <p className="pipeline-dropdown-group-label" style={{ margin: 0 }}>
                    Visible Columns
                  </p>
                  <button
                    type="button"
                    className="pipeline-cols-reset"
                    onClick={() => store.setColumns(DEFAULT_COLUMNS)}
                  >
                    Reset
                  </button>
                </div>
                {ALL_COLUMN_DEFS.map((def) => {
                  const visible = store.columns.includes(def.id);
                  const idx = store.columns.indexOf(def.id);
                  return (
                    <div key={def.id} className="pipeline-col-row">
                      <label className="pipeline-col-check">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleColumn(def.id)}
                        />
                        {def.label}
                      </label>
                      {visible && (
                        <div className="pipeline-col-move">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveColumn(def.id, -1)}
                            aria-label={`Move ${def.label} up`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === store.columns.length - 1}
                            onClick={() => moveColumn(def.id, 1)}
                            aria-label={`Move ${def.label} down`}
                          >
                            ▼
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => exportCsv(exportLoans)}
          title="Export as CSV"
        >
          Export
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={onRefresh}
          title="Refresh pipeline"
          aria-label="Refresh"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
