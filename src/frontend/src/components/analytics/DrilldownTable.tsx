// DrilldownTable — paginated table of loans that produced a metric value.
//
// Renders rows from useAnalyticsDrilldown(). Clicking a row opens the loan
// sidebar; the click handler is delegated up to the parent.
//
// Visuals: status pill, monogram avatar fallback for borrower, sticky header,
// zebra rows on hover, animated row entrance, skeleton placeholders while
// loading.

import { formatCurrency, formatDate } from "@/lib/utils";
import { loanStatusLabels, type LoanStatus } from "@/types/loan";
import type { DrilldownRow } from "@/types/analytics";

const COLUMN_LABELS: Record<string, string> = {
  loan_number:       "Loan #",
  borrower_name:     "Borrower",
  status:            "Status",
  loan_program:      "Program",
  loan_amount:       "Amount",
  submitted_at:      "Submitted",
  updated_at:        "Updated",
  assigned_to_name:  "Assigned",
  days_in_status:    "Days",
  open_conditions:   "Open Cond.",
  actions_needed:    "Actions",
};

type DrilldownTableProps = {
  rows: DrilldownRow[];
  columns: string[];
  loading?: boolean;
  onRowClick?: (loanId: string) => void;
};

const KNOWN_STATUSES = new Set<string>(Object.keys(loanStatusLabels));

export function DrilldownTable({
  rows,
  columns,
  loading = false,
  onRowClick,
}: DrilldownTableProps) {
  if (loading) {
    return (
      <div className="drilldown-table-wrapper">
        <table className="drilldown-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{COLUMN_LABELS[col] ?? col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="drilldown-row-skeleton">
                {columns.map((col) => (
                  <td key={col}><span className="skeleton-line short" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="drilldown-empty-state">
        <h4>No loans match this filter</h4>
        <p>Try widening your filters or selecting a different chart segment.</p>
      </div>
    );
  }

  return (
    <div className="drilldown-table-wrapper">
      <table className="drilldown-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{COLUMN_LABELS[col] ?? col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.id)}
              className={`drilldown-data-row ${onRowClick ? "drilldown-row-clickable" : ""}`}
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
            >
              {columns.map((col) => (
                <td key={col} className={`drilldown-cell drilldown-cell--${col}`}>
                  {renderCell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderCell(col: string, row: DrilldownRow): React.ReactNode {
  switch (col) {
    case "loan_number":
      return row.loan_number ? (
        <span className="drilldown-loan-number">{row.loan_number}</span>
      ) : (
        "—"
      );
    case "borrower_name":
      return (
        <span className="drilldown-borrower">
          <span className="drilldown-monogram" aria-hidden>{initialsOf(row.borrower_name)}</span>
          <span className="drilldown-borrower-name">{row.borrower_name ?? "—"}</span>
        </span>
      );
    case "status": {
      const label = KNOWN_STATUSES.has(row.status)
        ? loanStatusLabels[row.status as LoanStatus]
        : row.status;
      return <span className={`drilldown-status-pill drilldown-status-pill--${row.status}`}>{label}</span>;
    }
    case "loan_program":
      return row.loan_program ? (
        <span className="drilldown-program-pill">{row.loan_program.replace(/_/g, " ")}</span>
      ) : (
        "—"
      );
    case "loan_amount":
      return row.loan_amount != null ? (
        <span className="drilldown-amount">{formatCurrency(row.loan_amount)}</span>
      ) : (
        "—"
      );
    case "submitted_at":
      return formatDate(row.submitted_at);
    case "updated_at":
      return formatDate(row.updated_at);
    case "assigned_to_name":
      return row.assigned_to_name ? (
        <span className="drilldown-assigned">
          <span className="drilldown-assigned-dot" aria-hidden />
          {row.assigned_to_name}
        </span>
      ) : (
        <span className="muted">Unassigned</span>
      );
    case "days_in_status":
      if (row.days_in_status == null) return "—";
      const warn = row.days_in_status >= 14;
      return (
        <span className={`drilldown-days ${warn ? "drilldown-days--warn" : ""}`}>
          {row.days_in_status}d
        </span>
      );
    case "open_conditions": {
      const n = row.open_conditions;
      return n > 0 ? (
        <span className="drilldown-count drilldown-count--warn">{n}</span>
      ) : (
        <span className="drilldown-count drilldown-count--ok">0</span>
      );
    }
    case "actions_needed": {
      const n = row.actions_needed;
      return n > 0 ? (
        <span className="drilldown-count drilldown-count--warn">{n}</span>
      ) : (
        <span className="drilldown-count drilldown-count--muted">{n}</span>
      );
    }
    default:
      return "—";
  }
}