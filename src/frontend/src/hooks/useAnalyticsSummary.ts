// useAnalyticsSummary — fetches the dashboard KPIs + chart aggregates.
// Uses React Query for caching, background refetch, and request deduplication.
// staleTime is intentionally short so the freshness indicator ("Data as of X")
// reflects work done on a recent page load, not on a session ago.

import { useQuery } from "@tanstack/react-query";
import { getSummary } from "@/services/analyticsService";
import type { AnalyticsFilter, SummaryResponse } from "@/types/analytics";

/**
 * React Query hook for the dashboard summary endpoint.
 *
 * The query key is the filter object itself — every distinct filter shape
 * gets its own cache entry, which is what we want: filter A's KPI numbers
 * should not flash when the user switches to filter B.
 */
export function useAnalyticsSummary(filter: AnalyticsFilter, enabled = true) {
  return useQuery<SummaryResponse>({
    queryKey: ["analytics", "summary", filter],
    queryFn: () => getSummary(filter),
    enabled,
    // 60s cache is short enough that "stale" feels fresh but long enough to
    // absorb back-to-back filter edits without hammering the DB.
    staleTime: 60_000,
    // Don't auto-refetch on window focus — operators don't expect the page to
    // jump around while they're interacting with it. Manual refresh button.
    refetchOnWindowFocus: false,
  });
}