"""
Pydantic schemas for the analytics dashboard.

These are the wire contracts for:
  - GET  /api/v1/analytics/summary          (SummaryResponse)
  - POST /api/v1/analytics/drilldown        (DrilldownRequest -> DrilldownResponse)
  - GET  /api/v1/analytics/saved-views      (list)
  - POST /api/v1/analytics/saved-views      (create)
  - PATCH/DELETE /api/v1/analytics/saved-views/{id}

See docs/architecture/dashboard.md Section 5 (Data Architecture)
and Section 7 (Query Builder Design).
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Date presets ──────────────────────────────────────────────────────────────

class DatePreset(str, Enum):
    """Supported relative date range presets for the analytics filter bar."""
    TODAY         = "today"
    LAST_7_DAYS   = "last_7_days"
    LAST_30_DAYS  = "last_30_days"
    THIS_MONTH    = "this_month"
    LAST_MONTH    = "last_month"
    THIS_QUARTER  = "this_quarter"
    YEAR_TO_DATE  = "year_to_date"
    CUSTOM        = "custom"


# Fields a date range can be applied to. Limited to the columns that actually
# carry lifecycle dates on the loans table — keeps the filter surface honest.
DateRangeField = Literal[
    "submitted_at",
    "funding_date",
    "closing_date",
    "created_at",
]


class DateRangeFilter(BaseModel):
    """A single date-range restriction scoped to a loans table column."""
    field: DateRangeField
    preset: DatePreset
    from_date: Optional[date] = None  # only when preset = CUSTOM
    to_date: Optional[date] = None    # only when preset = CUSTOM


# ── Field filters ─────────────────────────────────────────────────────────────

class FieldFilter(BaseModel):
    """
    A single conditional filter on a whitelisted analytics field.

    The application layer (`app.core.analytics_filters`) is responsible for
    validating `field` against ALLOWED_FILTER_FIELDS and `operator` against
    ALLOWED_OPERATORS before this object ever reaches SQL. The schema is
    intentionally permissive here so the service can return a clear 400 with
    the offending field/operator instead of a generic validation error.
    """
    field: str
    operator: str
    value: Any = None


class SortSpec(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "desc"


# ── Analytics filter request (the canonical filter shape) ────────────────────

class AnalyticsFilterRequest(BaseModel):
    """
    The single canonical filter shape shared by:
      - GET /analytics/summary       (query parameters via Query(...))
      - POST /analytics/drilldown    (JSON body)
      - POST /analytics/export       (JSON body)
      - GET /analytics/saved-views/{id} (stored as filter_state JSONB)

    Frontend and backend both speak this object. The frontend never sends raw SQL;
    the backend never interpolates user values into SQL strings.
    """
    date_range: Optional[DateRangeFilter] = None
    filters: list[FieldFilter] = Field(default_factory=list)
    sort: list[SortSpec] = Field(default_factory=lambda: [SortSpec(field="updated_at", direction="desc")])
    limit: int = Field(default=25, ge=1, le=200)
    page: int = Field(default=1, ge=1)


class DrilldownRequest(AnalyticsFilterRequest):
    """
    Drill-down request body. Adds two fields on top of the filter shape:
      - metric_context: an opaque key identifying the chart/KPI the user clicked
        (e.g. "status:submitted", "program:dscr", "open_conditions")
      - columns: optional list of fields the caller wants in the response
    """
    metric_context: Optional[str] = None
    columns: Optional[list[str]] = None


# ── Response shapes ───────────────────────────────────────────────────────────

class AnalyticsMeta(BaseModel):
    """Stamped into every analytics response so the UI can render freshness."""
    computed_at: datetime
    tenant_id: UUID
    filter_summary: str = ""


class KpiCard(BaseModel):
    """
    One KPI tile. `drilldown_key` is the metric ID the frontend should send
    back in `DrilldownRequest.metric_context` when the user clicks it.
    """
    id: str
    label: str
    value: float
    formatted_value: str
    detail: Optional[str] = None
    tone: Optional[Literal["neutral", "info", "warning", "danger", "success"]] = None
    drilldown_key: Optional[str] = None


class StatusCountDatum(BaseModel):
    status: str
    label: str
    count: int


class StatusVolumeDatum(BaseModel):
    status: str
    label: str
    total_amount: Decimal


class ChannelMixDatum(BaseModel):
    program: Optional[str]
    label: str
    count: int
    pct: float


class MonthlySubmissionDatum(BaseModel):
    year: int
    month: int
    label: str
    count: int


class AgingByStatusDatum(BaseModel):
    status: str
    label: str
    avg_days: float
    max_days: int
    loan_count: int


class ActionNeededSummary(BaseModel):
    open_conditions: int = 0
    submitted_conditions: int = 0
    open_exceptions: int = 0
    stale_files: int = 0


class AnalyticsCharts(BaseModel):
    status_count: list[StatusCountDatum]
    status_volume: list[StatusVolumeDatum]
    channel_mix: list[ChannelMixDatum]
    monthly_submissions: list[MonthlySubmissionDatum]
    aging_by_status: list[AgingByStatusDatum]
    action_needed: ActionNeededSummary


class SummaryResponse(BaseModel):
    meta: AnalyticsMeta
    kpis: list[KpiCard]
    charts: AnalyticsCharts


# ── Drill-down response ───────────────────────────────────────────────────────

class DrilldownRow(BaseModel):
    id: UUID
    loan_number: Optional[str] = None
    borrower_name: Optional[str] = None
    status: str
    loan_program: Optional[str] = None
    loan_amount: Optional[Decimal] = None
    submitted_at: Optional[date] = None
    updated_at: datetime
    assigned_to_name: Optional[str] = None
    days_in_status: Optional[int] = None
    open_conditions: int = 0
    actions_needed: int = 0


class DrilldownMeta(BaseModel):
    total: int
    page: int
    limit: int
    metric_context: Optional[str] = None


class DrilldownResponse(BaseModel):
    meta: DrilldownMeta
    rows: list[DrilldownRow]
    columns: list[str]


# ── Saved views ───────────────────────────────────────────────────────────────

class SavedViewBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    filter_state: AnalyticsFilterRequest
    role_preset: Optional[str] = None
    is_shared: bool = False


class SavedViewCreate(SavedViewBase):
    pass


class SavedViewUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    filter_state: Optional[AnalyticsFilterRequest] = None
    role_preset: Optional[str] = None
    is_shared: Optional[bool] = None


class SavedViewOut(SavedViewBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime