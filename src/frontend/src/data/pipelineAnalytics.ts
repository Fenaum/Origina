import {
  loanStatusLabels,
  type ChartDatum,
  type LoanStatus,
  type LoanSummary,
  type MonthlySubmissionDatum,
  type PipelineKpi,
} from "@/types/loan";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

const statusOrder: LoanStatus[] = [
  "new_draft",
  "submitted",
  "conditions_review",
  "approved",
  "funded",
  "closed",
];

function isSameMonth(dateValue: string, now = new Date()): boolean {
  const date = new Date(`${dateValue}T00:00:00`);
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

export function buildPipelineKpis(loans: LoanSummary[]): PipelineKpi[] {
  const activeLoans = loans.filter((loan) => !["funded", "closed"].includes(loan.status));
  const totalVolume = activeLoans.reduce((sum, loan) => sum + loan.loanAmount, 0);
  const averageAmount = activeLoans.length ? totalVolume / activeLoans.length : 0;
  const actionsNeeded = loans.reduce((sum, loan) => sum + loan.actionsNeeded, 0);
  const submittedThisMonth = loans.filter(
    (loan) => loan.submittedAt && isSameMonth(loan.submittedAt),
  ).length;

  return [
    {
      label: "Total Active Loans",
      value: String(activeLoans.length),
      detail: `${loans.length} total in pipeline`,
    },
    {
      label: "Pipeline Volume",
      value: compactCurrencyFormatter.format(totalVolume),
      detail: currencyFormatter.format(totalVolume),
    },
    {
      label: "Average Loan Amount",
      value: compactCurrencyFormatter.format(averageAmount),
      detail: "Active files only",
    },
    {
      label: "Loans Needing Action",
      value: String(actionsNeeded),
      detail: "Open borrower or team actions",
    },
    {
      label: "Submitted This Month",
      value: String(submittedThisMonth),
      detail: "Based on submittedAt",
    },
  ];
}

export function buildStatusCountData(loans: LoanSummary[]): ChartDatum[] {
  return statusOrder.map((status) => ({
    name: loanStatusLabels[status],
    value: loans.filter((loan) => loan.status === status).length,
  }));
}

export function buildStatusAmountData(loans: LoanSummary[]): ChartDatum[] {
  return statusOrder.map((status) => ({
    name: loanStatusLabels[status],
    value: loans
      .filter((loan) => loan.status === status)
      .reduce((sum, loan) => sum + loan.loanAmount, 0),
  }));
}

export function buildChannelCountData(loans: LoanSummary[]): ChartDatum[] {
  const counts = loans.reduce<Record<string, number>>((acc, loan) => {
    acc[loan.channel] = (acc[loan.channel] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function buildActionNeededData(loans: LoanSummary[]): ChartDatum[] {
  return [
    {
      name: "Open Conditions",
      value: loans.reduce((sum, loan) => sum + loan.conditionsOpen, 0),
    },
    {
      name: "Submitted Conditions",
      value: loans.reduce((sum, loan) => sum + loan.conditionsSubmitted, 0),
    },
    {
      name: "Actions Needed",
      value: loans.reduce((sum, loan) => sum + loan.actionsNeeded, 0),
    },
  ];
}

export function buildMonthlySubmissionData(
  loans: LoanSummary[],
): MonthlySubmissionDatum[] {
  const monthBuckets = new Map<string, MonthlySubmissionDatum>();

  loans.forEach((loan) => {
    if (!loan.submittedAt) return;
    const date = new Date(`${loan.submittedAt}T00:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    const current = monthBuckets.get(key) ?? {
      month: monthFormatter.format(date),
      submissions: 0,
    };

    monthBuckets.set(key, {
      ...current,
      submissions: current.submissions + 1,
    });
  });

  return Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}
