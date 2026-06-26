// DrilldownTable — paginated table of loans that produced a metric value.
//
// Renders rows from useAnalyticsDrilldown(). Each row shows the columns the
// caller asked for (or the default set). Clicking a row opens the LoanSidePanel
// for the loan — the click handler is delegated up to the parent.
//
// Sorting is intentionally NOT done in the table itself; it is a server-side
// concern (handled by the DrilldownRequest.sort field). The current sort is
// shown as a subtle indicator on the column header if the caller provides one.

import { formatCurrency, formatDate } from "@/lib/utils";
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
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.id)}
              className={onRowClick ? "drilldown-row-clickable" : undefined}
            >
              {columns.map((col) => (
                <td key={col}>{renderCell(col, row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(col: string, row: DrilldownRow): React.ReactNode {
  switch (col) {
    case "loan_number":     return row.loan_number ?? "—";
    case "borrower_name":   return row.borrower_name ?? "—";
    case "status":          return row.status;
    case "loan_program":    return row.loan_program ?? "—";
    case "loan_amount":     return row.loan_amount != null ? formatCurrency(row.loan_amount) : "—";
    case "submitted_at":    return formatDate(row.submitted_at);
    case "updated_at":      return formatDate(row.updated_at);
    case "assigned_to_name":return row.assigned_to_name ?? "—";
    case "days_in_status":  return row.days_in_status ?? "—";
    case "open_conditions": return row.open_conditions;
    case "actions_needed":  return row.actions_needed;
    default:                return "—";
  }
}