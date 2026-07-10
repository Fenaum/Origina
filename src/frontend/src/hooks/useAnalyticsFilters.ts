// useAnalyticsFilters — single source of truth for the analytics filter state.
// Reads from URL query params on mount, writes back when the user changes a
// filter. Also exposes a drilldown context (the chart bar / KPI that the user
// clicked) and the active saved view ID.

import { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  DEFAULT_FILTER,
  EMPTY_DATE_RANGE,
  type AnalyticsFilter,
  type AnalyticsFilterUrlState,
  type DatePreset,
  type DateRangeField,
  type DateRangeFilter,
  type FieldFilter,
  type FilterField,
  type FilterOperator,
  type SortSpec,
} from "@/types/analytics";

const DATE_PRESETS: ReadonlyArray<DatePreset> = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_quarter",
  "year_to_date",
  "custom",
];

const DATE_FIELDS: ReadonlyArray<DateRangeField> = [
  "submitted_at",
  "funding_date",
  "closing_date",
  "created_at",
];

function isDatePreset(v: string | null): v is DatePreset {
  return v != null && (DATE_PRESETS as ReadonlyArray<string>).includes(v);
}

function isDateField(v: string | null): v is DateRangeField {
  return v != null && (DATE_FIELDS as ReadonlyArray<string>).includes(v);
}

/**
 * Read the URL query string into a partial AnalyticsFilter.
 * Anything not present in the URL is omitted so defaults can fill in.
 */
function urlToFilter(q: Record<string, string | string[] | undefined>): Partial<AnalyticsFilter> {
  const out: Partial<AnalyticsFilter> = {};

  const date_field = q.date_field;
  const date_preset = q.date_preset;
  if (isDateField(typeof date_field === "string" ? date_field : null) ||
      isDatePreset(typeof date_preset === "string" ? date_preset : null)) {
    const dr: DateRangeFilter = {
      field: (isDateField(typeof date_field === "string" ? date_field : null)
        ? (date_field as DateRangeField)
        : "submitted_at"),
      preset: (isDatePreset(typeof date_preset === "string" ? date_preset : null)
        ? (date_preset as DatePreset)
        : "last_30_days"),
    };
    if (dr.preset === "custom") {
      dr.fromDate = typeof q.date_from === "string" ? q.date_from : undefined;
      dr.toDate = typeof q.date_to === "string" ? q.date_to : undefined;
    }
    out.dateRange = dr;
  }

  const filters: FieldFilter[] = [];

  const pushMulti = (field: FilterField, raw: string | string[] | undefined) => {
    if (!raw) return;
    const values = Array.isArray(raw) ? raw : raw.split(",").filter(Boolean);
    if (values.length > 0) {
      filters.push({ field, operator: "in" as FilterOperator, value: values });
    }
  };

  pushMulti("status", q.status);
  pushMulti("loan_program", q.loan_program);
  pushMulti("purpose", q.purpose);

  if (typeof q.assigned_to === "string" && q.assigned_to) {
    filters.push({ field: "assigned_to", operator: "eq", value: q.assigned_to });
  }

  if (filters.length > 0) out.filters = filters;

  const sort: SortSpec[] = [];
  if (typeof q.sort_field === "string") {
    sort.push({
      field: q.sort_field,
      direction: q.sort_dir === "asc" ? "asc" : "desc",
    });
  }
  if (sort.length > 0) out.sort = sort;

  const page = Number(q.page);
  if (Number.isFinite(page) && page > 0) out.page = page;
  const limit = Number(q.limit);
  if (Number.isFinite(limit) && limit > 0) out.limit = limit;

  return out;
}

/**
 * Serialize the filter back to URL query params. Drops empty values so URLs
 * stay readable and shareable.
 */
function filterToUrl(filter: AnalyticsFilter): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};

  if (filter.dateRange) {
    out.date_field = filter.dateRange.field;
    out.date_preset = filter.dateRange.preset;
    if (filter.dateRange.preset === "custom") {
      if (filter.dateRange.fromDate) out.date_from = filter.dateRange.fromDate;
      if (filter.dateRange.toDate) out.date_to = filter.dateRange.toDate;
    }
  }

  for (const f of filter.filters) {
    if (f.value == null) continue;
    if (f.field === "status") {
      const arr = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
      if (arr.length > 0) out.status = arr;
    } else if (f.field === "loan_program") {
      const arr = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
      if (arr.length > 0) out.loan_program = arr;
    } else if (f.field === "purpose") {
      const arr = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
      if (arr.length > 0) out.purpose = arr;
    } else if (f.field === "assigned_to") {
      out.assigned_to = String(f.value);
    }
  }

  if (filter.sort.length > 0) {
    out.sort_field = filter.sort[0].field;
    out.sort_dir = filter.sort[0].direction;
  }
  if (filter.page > 1) out.page = String(filter.page);
  if (filter.limit && filter.limit !== 25) out.limit = String(filter.limit);

  return out;
}

export type UseAnalyticsFiltersResult = {
  filter: AnalyticsFilter;
  setFilter: (next: AnalyticsFilter) => void;
  updateFilter: (updater: (prev: AnalyticsFilter) => AnalyticsFilter) => void;
  drilldown: string | null;
  setDrilldown: (ctx: string | null) => void;
  viewId: string | null;
  setViewId: (id: string | null) => void;
  reset: () => void;
  urlState: AnalyticsFilterUrlState;
};

export function useAnalyticsFilters(): UseAnalyticsFiltersResult {
  const router = useRouter();

  // Derive filter state directly from the URL — no mirroring, no useEffect cascade.
  // setFilter/updateFilter write to the URL; the next render recomputes from there.
  const filter = useMemo<AnalyticsFilter>(() => {
    if (!router.isReady) return DEFAULT_FILTER;
    const partial = urlToFilter(router.query as Record<string, string | string[] | undefined>);
    return { ...DEFAULT_FILTER, ...partial };
  }, [router.isReady, router.query]);

  const drilldown = useMemo<string | null>(() => {
    if (!router.isReady) return null;
    const ctx = router.query.drilldown;
    return typeof ctx === "string" ? ctx : null;
  }, [router.isReady, router.query.drilldown]);

  const viewId = useMemo<string | null>(() => {
    if (!router.isReady) return null;
    const vid = router.query.view;
    return typeof vid === "string" ? vid : null;
  }, [router.isReady, router.query.view]);

  const writeUrl = useCallback(
    (next: AnalyticsFilter, ctx: string | null, vid: string | null) => {
      const params = filterToUrl(next);
      if (ctx) params.drilldown = ctx;
      if (vid) params.view = vid;
      // Preserve any unrelated query params (utm_*, etc.) — Next.js merges
      // shallow route updates, but explicit is safer.
      void router.replace(
        { pathname: router.pathname, query: { ...router.query, ...params } },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const setFilter = useCallback(
    (next: AnalyticsFilter) => {
      writeUrl(next, drilldown, viewId);
    },
    [drilldown, viewId, writeUrl],
  );

  const updateFilter = useCallback(
    (updater: (prev: AnalyticsFilter) => AnalyticsFilter) => {
      writeUrl(updater(filter), drilldown, viewId);
    },
    [filter, drilldown, viewId, writeUrl],
  );

  const setDrilldown = useCallback(
    (ctx: string | null) => {
      writeUrl(filter, ctx, viewId);
    },
    [filter, viewId, writeUrl],
  );

  const setViewId = useCallback(
    (vid: string | null) => {
      writeUrl(filter, drilldown, vid);
    },
    [filter, drilldown, writeUrl],
  );

  const reset = useCallback(() => {
    writeUrl(DEFAULT_FILTER, null, null);
  }, [writeUrl]);

  const urlState: AnalyticsFilterUrlState = useMemo(() => {
    const dr = filter.dateRange ?? EMPTY_DATE_RANGE;
    return {
      date_field: dr.field,
      date_preset: dr.preset,
      date_from: dr.fromDate ?? undefined,
      date_to: dr.toDate ?? undefined,
      statuses: filter.filters
        .filter((f) => f.field === "status")
        .flatMap((f) => (Array.isArray(f.value) ? f.value.map(String) : f.value != null ? [String(f.value)] : [])),
      loan_programs: filter.filters
        .filter((f) => f.field === "loan_program")
        .flatMap((f) => (Array.isArray(f.value) ? f.value.map(String) : f.value != null ? [String(f.value)] : [])),
      purposes: filter.filters
        .filter((f) => f.field === "purpose")
        .flatMap((f) => (Array.isArray(f.value) ? f.value.map(String) : f.value != null ? [String(f.value)] : [])),
      assigned_to: filter.filters.find((f) => f.field === "assigned_to")?.value as string | undefined,
      sort_field: filter.sort[0]?.field,
      sort_dir: filter.sort[0]?.direction,
      page: filter.page,
      limit: filter.limit,
      drilldown: drilldown ?? undefined,
      view: viewId ?? undefined,
    };
  }, [filter, drilldown, viewId]);

  return {
    filter,
    setFilter,
    updateFilter,
    drilldown,
    setDrilldown,
    viewId,
    setViewId,
    reset,
    urlState,
  };
}