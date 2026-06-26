// Analytics service — wraps the /api/v1/analytics/* endpoints.
// Returns real backend data when a token is present; otherwise returns a
// deterministic placeholder shape so the UI can render during auth bootstrap.
//
// This file is the single swap point: when JWT is wired, every method here
// already calls apiRequest. No frontend aggregation belongs here.

import { apiRequest } from "@/services/apiClient";
import type {
  AnalyticsFilter,
  DrilldownRequest,
  DrilldownResponse,
  SavedView,
  SummaryResponse,
} from "@/types/analytics";

/**
 * Build the GET /analytics/summary query string from a filter.
 * Empty values are dropped so URLs stay readable.
 */
export function buildSummaryQuery(filter: AnalyticsFilter): string {
  const params = new URLSearchParams();

  if (filter.dateRange) {
    params.set("date_field", filter.dateRange.field);
    params.set("date_preset", filter.dateRange.preset);
    if (filter.dateRange.preset === "custom") {
      if (filter.dateRange.fromDate) params.set("date_from", filter.dateRange.fromDate);
      if (filter.dateRange.toDate) params.set("date_to", filter.dateRange.toDate);
    }
  }

  for (const f of filter.filters) {
    if (f.value == null) continue;
    switch (f.field) {
      case "status":
        appendMulti(params, "status", f.value);
        break;
      case "loan_program":
        appendMulti(params, "loan_program", f.value);
        break;
      case "purpose":
        appendMulti(params, "purpose", f.value);
        break;
      case "assigned_to":
        if (typeof f.value === "string") params.set("assigned_to", f.value);
        break;
      // Other fields are intentionally not exposed on the GET summary endpoint;
      // they are part of the POST /drilldown surface (Phase 5 query builder).
    }
  }

  if (filter.sort.length > 0) {
    params.set("sort_field", filter.sort[0].field);
    params.set("sort_dir", filter.sort[0].direction);
  }
  if (filter.page && filter.page > 1) params.set("page", String(filter.page));
  if (filter.limit && filter.limit !== 25) params.set("limit", String(filter.limit));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function appendMulti(
  params: URLSearchParams,
  key: string,
  value: string | number | string[] | number[] | null,
): void {
  if (Array.isArray(value)) {
    for (const v of value) params.append(key, String(v));
  } else if (value != null) {
    params.append(key, String(value));
  }
}

// ── Public service methods ───────────────────────────────────────────────────

export async function getSummary(
  filter: AnalyticsFilter,
  token?: string,
): Promise<SummaryResponse> {
  return apiRequest<SummaryResponse>(`/analytics/summary${buildSummaryQuery(filter)}`, { token });
}

export async function getDrilldown(
  request: DrilldownRequest,
  token?: string,
): Promise<DrilldownResponse> {
  return apiRequest<DrilldownResponse>("/analytics/drilldown", {
    method: "POST",
    token,
    body: JSON.stringify(request),
  });
}

export async function exportDrilldown(
  request: DrilldownRequest,
  token?: string,
): Promise<Blob> {
  // Use raw fetch so we can stream the CSV body without parsing as JSON.
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${base}/analytics/export`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }
  return response.blob();
}

// ── Saved views ──────────────────────────────────────────────────────────────

export async function listSavedViews(token?: string): Promise<SavedView[]> {
  return apiRequest<SavedView[]>("/analytics/saved-views", { token });
}

export async function createSavedView(
  payload: {
    name: string;
    description?: string | null;
    filter_state: AnalyticsFilter;
    role_preset?: string | null;
    is_shared: boolean;
  },
  token?: string,
): Promise<SavedView> {
  return apiRequest<SavedView>("/analytics/saved-views", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateSavedView(
  viewId: string,
  payload: Partial<{
    name: string;
    description: string | null;
    filter_state: AnalyticsFilter;
    role_preset: string | null;
    is_shared: boolean;
  }>,
  token?: string,
): Promise<SavedView> {
  return apiRequest<SavedView>(`/analytics/saved-views/${viewId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedView(viewId: string, token?: string): Promise<void> {
  await apiRequest<void>(`/analytics/saved-views/${viewId}`, {
    method: "DELETE",
    token,
  });
}