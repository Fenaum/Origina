// ⚠️ DEPRECATED — kept for backward compatibility.
//
// The dashboard now reads KPIs and chart aggregates from the backend
// (GET /api/v1/analytics/summary). The frontend no longer aggregates loan
// lists in TypeScript — that pattern was a dead-end for an operational LOS
// because every number became unactionable (no path from the chart to the
// underlying loans).
//
// All aggregation now lives in:
//   - src/backend/app/services/analytics_repo.py
//   - src/backend/app/core/analytics_filters.py
//   - src/backend/app/api/v1/analytics.py
//
// These helpers are no longer imported by the analytics page. They remain
// exported here so any leftover callers (none expected) get a clear runtime
// warning instead of silent failure. Delete this file once the build has
// been clean for a sprint.

import type { ChartDatum, LoanSummary, MonthlySubmissionDatum } from "@/types/loan";

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

function warnDeprecated(name: string): void {
  if (typeof console !== "undefined") {
    console.warn(
      `[Origina] pipelineAnalytics.${name} is deprecated. Use the analytics service instead (see src/services/analyticsService.ts).`,
    );
  }
}

export function buildPipelineKpis(_loans: LoanSummary[]) {
  warnDeprecated("buildPipelineKpis");
  return [];
}

export function buildStatusCountData(_loans: LoanSummary[]): ChartDatum[] {
  warnDeprecated("buildStatusCountData");
  return [];
}

export function buildStatusAmountData(_loans: LoanSummary[]): ChartDatum[] {
  warnDeprecated("buildStatusAmountData");
  return [];
}

export function buildChannelCountData(_loans: LoanSummary[]): ChartDatum[] {
  warnDeprecated("buildChannelCountData");
  return [];
}

export function buildActionNeededData(_loans: LoanSummary[]): ChartDatum[] {
  warnDeprecated("buildActionNeededData");
  return [];
}

export function buildMonthlySubmissionData(_loans: LoanSummary[]): MonthlySubmissionDatum[] {
  warnDeprecated("buildMonthlySubmissionData");
  return [];
}

// Re-export the formatters so legacy callers that depended on them don't
// break at import time. They remain the source of truth for loan-level
// currency formatting outside the analytics dashboard.
export { currencyFormatter, compactCurrencyFormatter, monthFormatter };