// Analytics dashboard types — mirrors src/backend/app/schemas/analytics_schema.py.
// Keep in sync with the FastAPI Pydantic schemas.

// ── Filter shape ──────────────────────────────────────────────────────────────

export type DatePreset =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "year_to_date"
  | "custom";

export type DateRangeField =
  | "submitted_at"
  | "funding_date"
  | "closing_date"
  | "created_at";

export type DateRangeFilter = {
  field: DateRangeField;
  preset: DatePreset;
  fromDate?: string | null;
  toDate?: string | null;
};

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null"
  | "like";

export type FilterField =
  | "status"
  | "purpose"
  | "loan_program"
  | "loan_product"
  | "occupancy_type"
  | "submitted_at"
  | "funding_date"
  | "closing_date"
  | "created_at"
  | "assigned_to"
  | "loan_amount"
  | "ltv"
  | "fico_score"
  | "dscr"
  | "dti";

export type FieldFilter = {
  field: FilterField;
  operator: FilterOperator;
  value?: string | number | string[] | number[] | null;
};

export type SortSpec = {
  field: string;
  direction: "asc" | "desc";
};

export type AnalyticsFilter = {
  dateRange?: DateRangeFilter | null;
  filters: FieldFilter[];
  sort: SortSpec[];
  limit: number;
  page: number;
};

// ── Response shapes ──────────────────────────────────────────────────────────

export type AnalyticsMeta = {
  computed_at: string;
  tenant_id: string;
  filter_summary: string;
};

export type KpiTone = "neutral" | "info" | "warning" | "danger" | "success";

export type KpiCard = {
  id: string;
  label: string;
  value: number;
  formatted_value: string;
  detail?: string | null;
  tone?: KpiTone | null;
  drilldown_key?: string | null;
};

export type StatusCountDatum = {
  status: string;
  label: string;
  count: number;
};

export type StatusVolumeDatum = {
  status: string;
  label: string;
  total_amount: number;
};

export type ChannelMixDatum = {
  program: string | null;
  label: string;
  count: number;
  pct: number;
};

export type MonthlySubmissionDatum = {
  year: number;
  month: number;
  label: string;
  count: number;
};

export type AgingByStatusDatum = {
  status: string;
  label: string;
  avg_days: number;
  max_days: number;
  loan_count: number;
};

export type ActionNeededSummary = {
  open_conditions: number;
  submitted_conditions: number;
  open_exceptions: number;
  stale_files: number;
};

export type AnalyticsCharts = {
  status_count: StatusCountDatum[];
  status_volume: StatusVolumeDatum[];
  channel_mix: ChannelMixDatum[];
  monthly_submissions: MonthlySubmissionDatum[];
  aging_by_status: AgingByStatusDatum[];
  action_needed: ActionNeededSummary;
};

export type SummaryResponse = {
  meta: AnalyticsMeta;
  kpis: KpiCard[];
  charts: AnalyticsCharts;
};

// ── Drill-down ───────────────────────────────────────────────────────────────

export type DrilldownRow = {
  id: string;
  loan_number: string | null;
  borrower_name: string | null;
  status: string;
  loan_program: string | null;
  loan_amount: number | null;
  submitted_at: string | null;
  updated_at: string;
  assigned_to_name: string | null;
  days_in_status: number | null;
  open_conditions: number;
  actions_needed: number;
};

export type DrilldownMeta = {
  total: number;
  page: number;
  limit: number;
  metric_context: string | null;
};

export type DrilldownResponse = {
  meta: DrilldownMeta;
  rows: DrilldownRow[];
  columns: string[];
};

export type DrilldownRequest = AnalyticsFilter & {
  metric_context?: string | null;
  columns?: string[] | null;
};

// ── Saved views ──────────────────────────────────────────────────────────────

export type SavedView = {
  id: string;
  name: string;
  description?: string | null;
  filter_state: AnalyticsFilter;
  role_preset?: string | null;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// ── URL state serialization ──────────────────────────────────────────────────

/**
 * Compact, shareable URL representation of an AnalyticsFilter. Designed for
 * query strings (short keys, comma-separated lists). Round-trips losslessly
 * with toFilter().
 */
export type AnalyticsFilterUrlState = {
  date_field?: DateRangeField;
  date_preset?: DatePreset;
  date_from?: string;
  date_to?: string;
  statuses?: string[];
  loan_programs?: string[];
  purposes?: string[];
  assigned_to?: string;
  sort_field?: string;
  sort_dir?: "asc" | "desc";
  page?: number;
  limit?: number;
  drilldown?: string;
  view?: string;
};

export const DEFAULT_FILTER: AnalyticsFilter = {
  filters: [],
  sort: [{ field: "updated_at", direction: "desc" }],
  limit: 25,
  page: 1,
};

export const EMPTY_DATE_RANGE: DateRangeFilter = {
  field: "submitted_at",
  preset: "last_30_days",
};