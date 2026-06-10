import type { LoanSummary } from "@/types/loan";
import type { PipelineFilters, SortField, SortDir } from "@/state/pipelineStore";

export function computeDaysActive(loan: LoanSummary): number {
  const from = loan.submittedAt ?? loan.updatedAt;
  const ms = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function applyPipelineFilters(
  loans: LoanSummary[],
  filters: PipelineFilters,
): LoanSummary[] {
  let result = loans;

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (l) =>
        l.borrowerName.toLowerCase().includes(q) ||
        l.loanNumber.toLowerCase().includes(q) ||
        l.owner.toLowerCase().includes(q) ||
        l.propertyState.toLowerCase().includes(q),
    );
  }

  if (filters.statuses.length > 0) {
    result = result.filter((l) => filters.statuses.includes(l.status));
  }

  if (filters.programs.length > 0) {
    result = result.filter((l) => filters.programs.includes(l.loanProgram));
  }

  if (filters.minAmount !== "") {
    const min = parseFloat(filters.minAmount.replace(/[^0-9.]/g, ""));
    if (!isNaN(min)) result = result.filter((l) => l.loanAmount >= min);
  }

  if (filters.maxAmount !== "") {
    const max = parseFloat(filters.maxAmount.replace(/[^0-9.]/g, ""));
    if (!isNaN(max)) result = result.filter((l) => l.loanAmount <= max);
  }

  if (filters.actionNeeded) {
    result = result.filter((l) => l.actionsNeeded > 0);
  }

  if (filters.conditionsOutstanding) {
    result = result.filter((l) => l.conditionsOpen > 0);
  }

  return result;
}

export function applyPipelineSort(
  loans: LoanSummary[],
  field: SortField,
  dir: SortDir,
): LoanSummary[] {
  return [...loans].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "loanNumber":
        cmp = a.loanNumber.localeCompare(b.loanNumber);
        break;
      case "borrowerName":
        cmp = a.borrowerName.localeCompare(b.borrowerName);
        break;
      case "loanAmount":
        cmp = a.loanAmount - b.loanAmount;
        break;
      case "conditionsOpen":
        cmp = a.conditionsOpen - b.conditionsOpen || a.actionsNeeded - b.actionsNeeded;
        break;
      case "actionsNeeded":
        cmp = a.actionsNeeded - b.actionsNeeded;
        break;
      case "submittedAt":
        cmp = (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
        break;
      case "updatedAt":
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
      case "daysActive":
        cmp = computeDaysActive(a) - computeDaysActive(b);
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}
