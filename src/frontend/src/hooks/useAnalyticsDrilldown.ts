// useAnalyticsDrilldown — fetches the paginated list of loans that produced a
// KPI value or chart bar. Used by the DrilldownTable panel.

import { useQuery } from "@tanstack/react-query";
import { getDrilldown } from "@/services/analyticsService";
import type { DrilldownRequest, DrilldownResponse } from "@/types/analytics";

/**
 * Drill-down query hook.
 *
 * The query key includes the metric context, the underlying filter, and the
 * page number — clicking a different chart bar or moving to page 2 of the
 * table produces a fresh cache entry.
 */
export function useAnalyticsDrilldown(request: DrilldownRequest, enabled = true) {
  return useQuery<DrilldownResponse>({
    queryKey: [
      "analytics",
      "drilldown",
      request.metric_context ?? null,
      request,
      request.page,
    ],
    queryFn: () => getDrilldown(request),
    enabled,
    // Drill-down results are slightly less cache-friendly than the summary
    // because the user is actively navigating. Keep stale time short.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}