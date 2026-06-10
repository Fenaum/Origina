import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { loanProgramLabels, loanStatusLabels, type LoanSummary } from "@/types/loan";
import {
  ALL_COLUMN_DEFS,
  usePipelineStore,
  type ColumnId,
} from "@/state/pipelineStore";
import { computeDaysActive } from "@/data/pipelineFilters";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function CellValue({ col, loan }: { col: ColumnId; loan: LoanSummary }) {
  switch (col) {
    case "loanNumber":
      return (
        <Link href={`/loans/${loan.id}`} className="pipeline-loan-link">
          {loan.loanNumber}
        </Link>
      );
    case "borrowerName":
      return <span className="pipeline-borrower">{loan.borrowerName}</span>;
    case "status":
      return (
        <span
          className={`status-pill status-pill--${loan.status.replace(/_/g, "-")}`}
        >
          {loanStatusLabels[loan.status]}
        </span>
      );
    case "loanProgram":
      return (
        <span className="pipeline-program">
          {loanProgramLabels[loan.loanProgram] ?? loan.loanProgram}
        </span>
      );
    case "loanAmount":
      return (
        <span className="pipeline-amount">{currencyFmt.format(loan.loanAmount)}</span>
      );
    case "channel":
      return <span>{loan.channel}</span>;
    case "propertyState":
      return <span>{loan.propertyState}</span>;
    case "owner":
      return <span className="pipeline-owner">{loan.owner}</span>;
    case "conditionsOpen":
      return (
        <span
          className={`pipeline-count-badge${loan.conditionsOpen > 0 ? " pipeline-count-badge--warn" : " pipeline-count-badge--ok"}`}
        >
          {loan.conditionsOpen > 0
            ? `${loan.conditionsOpen} open${loan.conditionsSubmitted > 0 ? ` · ${loan.conditionsSubmitted} sub` : ""}`
            : "Clear"}
        </span>
      );
    case "actionsNeeded":
      return (
        <span
          className={`pipeline-count-badge${loan.actionsNeeded > 0 ? " pipeline-count-badge--warn" : " pipeline-count-badge--ok"}`}
        >
          {loan.actionsNeeded > 0 ? loan.actionsNeeded : "—"}
        </span>
      );
    case "submittedAt":
      return <span className="pipeline-date">{formatDate(loan.submittedAt)}</span>;
    case "updatedAt":
      return <span className="pipeline-date">{formatDate(loan.updatedAt)}</span>;
    case "daysActive":
      return (
        <span className="pipeline-days">{computeDaysActive(loan)}d</span>
      );
    default:
      return <span>—</span>;
  }
}

function RowMenu({
  loan,
  onClose,
}: {
  loan: LoanSummary;
  onClose: () => void;
}) {
  const router = useRouter();

  function go(path: string) {
    void router.push(path);
    onClose();
  }

  return (
    <div className="pipeline-row-menu" role="menu">
      <button
        role="menuitem"
        className="pipeline-row-menu-item"
        onClick={() => go(`/loans/${loan.id}`)}
      >
        Open Loan
      </button>
      <button
        role="menuitem"
        className="pipeline-row-menu-item"
        onClick={() => go(`/loans/${loan.id}?section=conditions`)}
      >
        View Conditions
      </button>
      <button
        role="menuitem"
        className="pipeline-row-menu-item"
        onClick={() => go(`/loans/${loan.id}?section=notes`)}
      >
        Add Note
      </button>
      <div className="pipeline-row-menu-sep" role="separator" />
      <button
        role="menuitem"
        className="pipeline-row-menu-item"
        onClick={() => {
          void navigator.clipboard.writeText(loan.loanNumber);
          onClose();
        }}
      >
        Copy Loan #
      </button>
    </div>
  );
}

export function PipelineGrid({ loans }: { loans: LoanSummary[] }) {
  const { columns, sortField, sortDir, toggleSort } = usePipelineStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const visibleDefs = ALL_COLUMN_DEFS.filter((d) => columns.includes(d.id)).sort(
    (a, b) => columns.indexOf(a.id) - columns.indexOf(b.id),
  );

  if (loans.length === 0) {
    return (
      <div className="pipeline-empty">
        <p className="pipeline-empty-msg">No loans match the current filters.</p>
        <button
          type="button"
          className="ghost-button"
          onClick={() => usePipelineStore.getState().resetFilters()}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="pipeline-grid-wrap">
      <div className="pipeline-table-wrap">
        <table className="pipeline-table">
          <thead>
            <tr>
              {visibleDefs.map((def) => (
                <th
                  key={def.id}
                  className={def.sortKey ? "sortable-th" : ""}
                  onClick={def.sortKey ? () => toggleSort(def.sortKey!) : undefined}
                  aria-sort={
                    def.sortKey && sortField === def.sortKey
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {def.label}
                  {def.sortKey && sortField === def.sortKey && (
                    <span className="sort-indicator" aria-hidden>
                      {sortDir === "asc" ? " ↑" : " ↓"}
                    </span>
                  )}
                </th>
              ))}
              <th className="pipeline-actions-th" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr
                key={loan.id}
                className={`pipeline-row${loan.actionsNeeded > 0 ? " pipeline-row--action" : ""}`}
                onClick={() => {
                  if (openMenuId === loan.id) setOpenMenuId(null);
                }}
              >
                {visibleDefs.map((def) => (
                  <td key={def.id}>
                    <CellValue col={def.id} loan={loan} />
                  </td>
                ))}
                <td className="pipeline-actions-td">
                  <div className="pipeline-row-action-wrap">
                    <button
                      type="button"
                      className="pipeline-row-action-btn"
                      aria-label="Row actions"
                      aria-expanded={openMenuId === loan.id}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((id) => (id === loan.id ? null : loan.id));
                      }}
                    >
                      ···
                    </button>
                    {openMenuId === loan.id && (
                      <RowMenu loan={loan} onClose={() => setOpenMenuId(null)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pipeline-grid-footer">
        {loans.length} loan{loans.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
