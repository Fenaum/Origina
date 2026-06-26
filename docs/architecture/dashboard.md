---
Origina Analytics Dashboard — Architecture Specification

---
1. Product Vision

The analytics page today is a reporting screen: static charts, frontend-computed aggregates, no path from a number to the underlying loans. That is a dead end for an operational LOS.

The target is an operational command center. Every number must be explainable. Every metric must be drilllable to the loan list that produced it. Every chart click must open the specific files it represents. The dashboard is not a place to admire trends — it is a place to find what needs action today and navigate directly to it.

The governing principle: if a user sees "14 open conditions," they must be able to click it, see the 14 loans, and open any one of them. The moment a number becomes unactionable, it becomes noise.

What it is not: this is not a BI platform. You are not building Looker. You are building a focused operational surface tuned to the Non-QM TPO workflow. Resist the temptation to add report builders, custom dashboards, or chart customization in the first year.

---
2. UX Architecture

Layout zones

┌─────────────────────────────────────────────────────────────────────┐
│  TOP HEADER (role label, data freshness, refresh, export, saved     │
│  views selector)
  - condition collection
  - borrower/team actions
  - stale files

  4. Metrics catalog
  Create a strong metric catalog with:
  - Metric name
  - Description
  - SQL/data source concept
  - Applicable roles
  - Drill-down behavior
  - Recommended chart type

  Include metrics for:
  - Total active loans
  - Pipeline volume
  - Average loan amount
  - Submitted this month
  - Loans needing action
  - Status distribution
  - Volume by status
  - Channel mix
  - Monthly submission trend
  - Aging by status
  - Average turn time
  - SLA breach count
  - Open conditions
  - Conditions aging
  - Exceptions by severity/status
  - Files with no activity
  - Loans by owner
  - Loans by investor/product/state

  5. Data architecture
  Design the backend analytics layer.
 Multi-tenant enforcement
  - RBAC enforcement
  - Pagination for drill-down rows
  - Sorting
  - Export support

  Propose endpoints similar to:
  - GET /analytics/summary
  - POST /analytics/query
  - GET /analytics/metrics/catalog
  - GET /analytics/saved-views
  - POST /analytics/saved-views
  - POST /analytics/export
  - GET /analytics/drilldown

  6. PostgreSQL architecture
  Recommend how to query this efficiently.

  Cover:
  - Direct SQL vs materialized views
  - When to use views
  - When to use materialized views
  - Indexing strategy
  - Composite indexes
  - Partial indexes
  - Date indexes
  - tenant_id-first indexing
  - avoiding over-indexing
  - JSONB caution
  - query explain/analyze process

  Include example SQL concepts for:
  - Count by status
  - Volume by status
  - Aging by current status
  - Open conditions by loan
  - Submitted this month
  - Loans needing action
  - Last activity date
  - SLA breach detection

  7. Query builder design
  Design a safe query builder that allows business users to filter analytics without writing SQL.

  Requirements:
  - No raw SQL from frontend
  - Whitelisted fields only
  - Whitelisted operators only
  - Typed filters
  - Support AND/OR groups eventually
  - Support relative date filters like last 7 days, last 30 days, this month, this quarter
  - Support saved filter presets

  Example filter object:
  {
    "dateRange": {
      "field": "submitted_at",
      "preset": "last_30_days"
    },
    "filters": [
      {
        "field": "status",
        "operator": "in",
        "value": ["submitted", "conditions_review"]
      },
      {
        "field": "loan_amount",
        "operator": "gte",
        "value": 500000
      }
    ],
    "groupBy": ["status"],
    "sort": [{"field": "loan_amount", "direction": "desc"}],
    "limit": 50
  }

  8. Frontend architecture
  Recommend Next.js/TypeScript component structure.

  Include:
  - AnalyticsPage
  - AnalyticsFilterBar
  - MetricCard
  - ChartCard
  - DrilldownTable
  - SavedViewsDropdown
  - QueryBuilderPanel
  - AnalyticsRolePreset
  - ExportButton
  - EmptyState
  - LoadingSkeleton
  - ErrorState

eak implementation into phases:

  Phase 1:
  Replace mock data with backend-backed summary metrics.

  Phase 2:
  Add global filters and URL state.

  Phase 3:
  Add drill-down loan table.

  Phase 4:
  Add saved views.

  Phase 5:
  Add query builder.

  Phase 6:
  Add materialized views/performance optimization.

  Phase 7:
  Add role-specific analytics and manager dashboard.

  10. Deliverables
  Provide:
  - Final architecture recommendation
  - File/folder structure
  - API contract examples
  - database view/materialized view recommendations
  - frontend component plan
  - implementation checklist
  - risks and tradeoffs
  - what not to build yet

  Important constraints:
  - Keep the first implementation practical.
  - Do not overbuild a BI platform.
  - Prioritize operational usefulness over decorative charts.
  - Every number must be explainable and drillable.
  - Analytics must respect tenant_id and role permissions.
  - This is for a Non-QM LOS/TPO system, not a generic SaaS dashboard.

Let me review the current dashboard implementation and data model before producing the architecture.

  Searched for 4 patterns, read 12 files

I have a thorough read on the schema, the current analytics page, the chart components, mock data shapes, and all relevant migrations. Let me now produce the full architecture document.

---
Origina Analytics Dashboard — Architecture Specifi
e target is an operational command center. Every number must be explainable. Every metric must be drilllable to the loan list that produced it. Every chart click must open the specific files it represents. The dashboard is not a place to admire trends — it is a place to find what needs action today and navigate directly to it.

The governing principle: if a user sees "14 open conditions," they must be able to click it, see the 14 loans, and open any one of them. The moment a number becomes unactionable, it becomes noise.

What it is not: this is not a BI platform. You are not building Looker. You are building a focused operational surface tuned to the Non-QM TPO workflow. Resist the temptation to add report builders, custom dashboards, or chart customization in the first year.

---
2. UX Architecture

Layout zones

┌─────────────────────────────────────────────────────────────────────┐
│  TOP HEADER (role label, data freshness, refresh, export, saved     │
│  views selector)                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  GLOBAL FILTER BAR                                                  │
│  [Date Range ▾] [Status ▾] [Loan Program ▾] [Owner ▾] [+ Filter]   │
│  Active chips: "Status: submitted, conditions_review"  [✕ Clear]    │
├─────────────────────────────────────────────────────────────────────┤
│  KPI STRIP (5–6 cards, horizontal scroll on mobile)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │Active│ │Volume│ │Avg $ │ │Action│ │SLA   │                      │
│  │Loans │ │      │ │      │ │Needed│ │Risk  │                      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                     │
├───────────────────────────────┬─────────────────────────────────────┤
│  CHART GRID (2-col)           │  SIDE PANEL (drill-down detail)     │
│  ┌─────────┐  ┌─────────┐    │  Opens when a table row is clicked  │
│  │ Status  │  │ Volume  │    │  Shows loan summary + quick links   │
│  │ Count   │  │ by      │    │
│  └─────────┘  │ Status  │    │  [Loan #] [Status] [Borrower]       │
│  ┌─────────┐  └─────────┘    │  [AE] [Program] [Conditions: 3]     │
│  │ Channel │  ┌─────────┐    │  [Open in Workspace →]              │
│  │ Mix     │  │Aging    │    │                                     │
│  └─────────┘  │by Status│    │                                     │
│  ┌──────────────────────┐    │                                     │
│  │ Monthly Trend (wide) │    │                                     │
│  └──────────────────────┘    │                                     │
├───────────────────────────────┴─────────────────
────────────────────────────────────────────────────────────────────┘

Global filters (always affect all metrics and charts)

┌──────────────┬────────────────────────────┬──────────────────────────────────────────────────────────────┐
│    Filter    │            Type            │                            Source                            │
├──────────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Date range   │ Preset or custom range     │ Applied to submitted_at or funding_date depending on context │
├──────────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Status       │ Multi-select               │ loan_status enum values                                      │
├──────────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Loan program │ Multi-select               │ loans.loan_program distinct values                           │
├──────────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Assigned to  │ Single select (owner/user) │ loans.assigned_to or loan_parties                            │
├──────────────┼────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Loan purpose │ Multi-select               │ loans.purpose (purchase/refinance/cash_out)                  │
└──────────────┴────────────────────────────┴──────────────────────────────────────────────────────────────┘

Chart-specific filters

Some charts have their own secondary filter that does not affect the KPI strip. Example: the Monthly Trend chart has a "group by" toggle (submissions / fundings / approvals). These are rendered as small controls inside the chart card, not in the global bar.

Drill-down mechanics

1. User clicks a chart bar or KPI card.
2. The filter context for that click (e.g., status = 'submitted') is encoded into a drilldown parameter.
3. A DrilldownTable panel slides up from the bottom of the page (or replaces the chart grid on mobile).
4. The table calls POST /api/v1/analytics/drilldown with the active global filters merged with the chart-specific drilldown context.
5. Clicking a row in the table opens the SidePanel with a loan summary and a "Open in Workspace" link.
6. The URL is updated with ?drilldown=status:submitted so the state is shareable.

Preventing clutter
Saved views are accessed from a dropdown in the header, not a persistent sidebar.

Data freshness indicator

A small line in the top header: Data as of 2:41 PM · Refresh. The timestamp comes from the API response meta.computed_at. Refresh triggers a full refetch with the same filters.

---
3. Role-Based Dashboard Strategy

Each role sees a curated metric preset — a fixed set of KPI slots and chart slots appropriate to their work. The underlying API is the same; the presets define which metrics and chart configurations are loaded.

Admin

- Tenant-wide view, no row-level restriction.
- Role preview mode: can switch the preset to any other role and see what that role would see (read-only simulation, backend RBAC unchanged).
- System health card: last activity across the pipeline, any stale files (no updates in 5+ days).
- KPIs: Total Pipeline Volume, Active Loans, Funded MTD, Open Exceptions, SLA Breaches.
- Charts: Status distribution (count + volume), Team workload heatmap, Monthly trend.

Manager

- Team workload view: loans grouped by assigned processor / underwriter.
- SLA risk: loans past 48h in a status with no activity (derived from loan_status_events.occurred_at).
- Bottleneck lens: which status has the most loans aging longest.
- KPIs: Team Pipeline Volume, SLA At Risk (count), Funded MTD vs Target, Open Exceptions, Avg Turn Time (submitted → approved).
- Charts: Workload by assignee (bar), Aging by status (horizontal bar), Monthly funded trend.

Underwriter

- Assigned queue only (loans where assigned_to = current_user_id or loan_parties contains their ID in underwriter role).
- Open conditions needing review (conditions with  queue loans).
Broker partner pipeline: loans where AE is in loan_parties with role = 'account_executive'.
- Fallout risk: loans submitted 10+ days ago still in conditions_review with no recent conditions cleared.
- Broker activity: new submissions by broker in the last 30 days.
- KPIs: My Broker Pipeline Volume, Submissions MTD, Loans Needing AE Action, Fallout Risk Count.
- Charts: Pipeline by broker (bar), Status distribution of my loans, Monthly submission trend.

Broker/Seller

- Their submitted loans only: loan_parties where party_id = their party_id and role = 'broker'.
- No visibility into other brokers or internal users.
- Conditions needed on their loans: conditions.status = 'open' or 'submitted'.
- Closing readiness: loans in approved_pending or approved status.
- KPIs: My Active Loans, Open Conditions Needed, Approved Ready to Close, Funded MTD.
- Charts: Status distribution of my loans, Conditions summary.

Processor

- Document gaps: loans with conditions in open status that are their assigned files.
- Stale files: assigned loans with no update in 3+ days.
- Ready for UW: loans with all conditions cleared, awaiting status transition.
- KPIs: My Active Files, Open Conditions Pending, Cleared This Week, Ready for UW.
- Charts: Condition aging by loan, Files by status.

Funder

- Approved files ready to fund: status = 'approved'.
- Outstanding closing docs: loans with open document conditions near closing date.
- Funded this month: volume and count.
- KPIs: Ready to Fund, Docs Outstanding, Funded MTD Count, Funded MTD Volume.
- Charts: Closing date pipeline (by week), Funded trend.

---
4. Metrics Catalog

Each entry: Metric Name | Description | SQL concep | Applicable roles | Drill-down | Chart type.

---
Pipeline & Volume

Total Active Loans
Count of loans where status NOT IN ('funded','closed','denied','withdrawn','cancelled').
Query: SELECT COUNT(*) FROM loans WHERE tenant_id = $1 AND status NOT IN (...).
Roles: All. Drill-down: full loan list filtered to active statuses. Chart: KPI card.

Pipeline Volume
SUM(lf.loan_amount) joined from loan_financials. Applies same active status filter.
Roles: Admin, Manager, AE, Broker. Drill-down: sorted by loan_amount desc. Chart: KPI card.

Average Loan Amount
AVG(lf.loan_amount) on active loans, cross-joined with loan_financials.
Roles: Admin, Manager. Drill-down: full list sorted by amount. Chart: KPI card.

Submitted This Month
COUNT(*) WHERE submitted_at >= date_trunc('month',
Roles: All. Drill-down: loans submitted this calen

Funded MTD
SUM(lf.loan_amount) WHERE status = 'funded' AND funding_date >= date_trunc('month', now()).
Roles: Admin, Manager, Funder. Drill-down: funded card + trend line.

---
Workflow & Operational

Loans Needing Action
Count of loans with at least one condition in status = 'open' where the responsible party has not updated in 48h. Derived: LEFT JOIN conditions c ON c.loan_id = l.id WHERE c.status = 'open', grouped, HAVING MAX(c.updated_at) < now() - interval '48 hours'.
Roles: Admin, Manager, Processor, AE. Drill-down: the specific loans. Chart: KPI card (warning tone).

Open Conditions Count
SELECT COUNT(*) FROM conditions WHERE tenant_id = $1 AND status = 'open'. For role-scoped users, filtered to their assigned loans.
Roles: All except Broker sees only their loans. Drill-down: conditions grouped by loan. Chart: KPI card + bar.

Submitted Conditions (Awaiting Review)
les With No Activity
Loans where updated_at < now() - interval '72 hours' and status is active.
Roles: Admin, Manager. Drill-down: stale loan list. Chart: KPI card (warning).

---
Aging & SLA

Aging by Status
Time in current status: now() - se.occurred_at where se is the most recent loan_status_events row per loan.
SQL concept:
WITH latest_event AS (
  SELECT DISTINCT ON (loan_id)
    loan_id, to_status, occurred_at
  FROM loan_status_events
  WHERE tenant_id = $1
  ORDER BY loan_id, occurred_at DESC
)
SELECT l.status,
       AVG(now() - le.occurred_at) AS avg_age,
       MAX(now() - le.occurred_at) AS max_age
FROM loans l
JOIN latest_event le ON le.loan_id = l.id
WHERE l.tenant_id = $1 AND l.status NOT IN ('funded','closed')
GROUP BY l.status
Roles: Admin, Manager, Underwriter. Drill-down: loans in that status sorted by age desc. Chart: Horizontal bar (avg days in status).

SLA Breach Count
Loans in submitted or conditions_review for > 5 business days (configurable per tenant). Uses loan_status_events timestamp of status entry.
Roles: Admin, Manager. Drill-down: breached loan list. Chart: KPI card (danger tone).

Average Turn Time (Submitted → Approved)
AVG(approved_at - submitted_at) derived from joinis per loan.
SQL concept:
SELECT AVG(
  EXTRACT(EPOCH FROM (a.occurred_at - s.occurred_at)) / 86400
) AS avg_days
FROM loan_status_events s
JOIN loan_status_events a ON a.loan_id = s.loan_id
  AND a.to_status = 'approved'
WHERE s.to_status = 'submitted'
  AND s.tenant_id = $1
Roles: Admin, Manager. Chart: KPI card + trend.

---
Distribution

Status Distribution (Count)
COUNT(*) GROUP BY status. Standard bar chart.
UNT(*) GROUP BY loan_program or channel field. Shows DSCR vs Bank Statement vs Jumbo split.
Roles: Admin, Manager. Chart: Pie / donut.

Loans by Program
COUNT(*), SUM(loan_amount) GROUP BY loan_program.
Roles: Admin, Manager, AE. Chart: Horizontal bar.

Loans by State
Requires joining properties table: GROUP BY prop.state. Shows geographic distribution.
Roles: Admin, Manager. Chart: Bar or map (future).

---
Exceptions

Open Exceptions by Severity
COUNT(*) FROM exceptions WHERE status = 'open' GROUP BY severity.
Roles: Admin, Manager, Underwriter. Drill-down: exception list. Chart: Stacked bar (critical/high/medium/low).

Exception Approval Rate
COUNT(*) FILTER (WHERE status = 'approved') / COUNT(*) over a time window.
Roles: Admin, Manager. Chart: KPI card (percentage).

Avg Exception Resolution Time
From exception_events: occurred_at WHERE event_type IN ('approved','denied','withdrawn') minus created_at on exceptions.
Roles: Admin, Manager. Chart: KPI card.

---
Team & Assignment

Loans by Owner
COUNT(*), SUM(lf.loan_amount) GROUP BY l.assigned_to joined with users.full_name.
Roles: Admin, Manager. Drill-down: that user's loan list. Chart: Bar chart.

Underwriter / Processor Capacity
Queue count per assigned underwriter or processor. Highlight users over a threshold.
Roles: Admin, Manager. Chart: Bar with threshold line.

---
5. Data Architecture

Service structure

src/backend/app/
  api/v1/
    analytics.py          ← FastAPI router, all /analytics/* endpoints
  services/
    analytics_repo.py     ← All query logic
  schemas/
    analytics_schema.py   ← Request/response DTOs
  core/
    analytics_filters.py  ← Filter validation and SQL builder

API endpoints

GET  /api/v1/analytics/summary
POST /api/v1/analytics/drilldown
GET  /api/v1/analytics/metrics/{metric_id}
GET  /api/v1/analytics/saved-views
POST /api/v1/analytics/saved-views
PATCH /api/v1/analytics/saved-views/{view_id}
DELETE /api/v1/analytics/saved-views/{view_id}
POST /api/v1/analytics/export

GET /api/v1/analytics/summary

Query params: date_field, date_from, date_to, date_preset, status[], loan_program[], assigned_to, purpose[].

Response shape:
{
  "meta": {
    "computed_at": "2026-06-25T14:41:00Z",
    "tenant_id": "...",
    "filter_summary": "Last 30 days · status: submitted, conditions_review"
  },
  "kpis": [
    {
      "id": "total_active_loans",
      "label": "Total Active Loans",
      "value": 42,
      "formatted_value": "42",
      "detail": "3 added today",
      "tone": null,
      "drilldown_key": "active_loans"
    }
  ],
  "charts": {
    "status_count": [{ "status": "submitted", "label": "Submitted", "count": 12 }],
    "status_volume": [{ "status": "submitted", "label": "Submitted", "total_amount": 8400000 }],
    "channel_mix": [{ "program": "dscr", "label": "DSCR", "count": 18, "pct": 42.8 }],
    "monthly_submissions": [{ "year": 2026, "month": 5, "label": "May", "count": 23 }],
    "aging_by_status": [{ "status": "conditions_review", "avg_days": 4.2, "max_days": 11 }],
    "action_needed": {
      "open_conditions": 31,
      "submitted_conditions": 14,
      "open_exceptions": 6,
      "stale_files": 3
    }
  }
}

POST /api/v1/analytics/drilldown

Request body: a DrilldownRequest (see Section 7 filter schema extended with a metric_context).

Response:
{
  "meta": { "total": 14, "page": 1, "limit": 25, "
  "rows": [
    {
      "id": "uuid",
      "loan_number": "OR-1042",
      "borrower_name": "Garcia, Maria",
      "status": "conditions_review",
      "loan_program": "dscr",
      "loan_amount": 725000,
      "submitted_at": "2026-06-10",
      "assigned_to_name": "Sarah Chen",
      "days_in_status": 7,
      "open_conditions": 3,
      "actions_needed": 2
    }
  ],
  "columns": ["loan_number","borrower_name","status","loan_amount","days_in_status","open_conditions"]
}


Accepts the same filter body as drilldown. Returns a CSV stream. Enforces a row cap (5,000) for safety. Uses StreamingResponse in FastAPI.

Schema definitions (analytics_schema.py)

class DatePreset(str, Enum):
    TODAY = "today"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    YEAR_TO_DATE = "year_to_date"
    CUSTOM = "custom"

class DateRangeFilter(BaseModel):
    field: Literal["submitted_at", "funding_date", "closing_date", "created_at"]
    preset: DatePreset
    from_date: Optional[date] = None  # only when preset = CUSTOM
    to_date: Optional[date] = None

class FieldFilter(BaseModel):
    field: str          # validated against ALLOWED_FILTER_FIELDS whitelist
    operator: str       # validated against ALLOWED_OPERATORS whitelist
    value: Any          # typed per field

class SortSpec(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "desc"

class AnalyticsFilterRequest(BaseModel):
    date_range: Optional[DateRangeFilter] = None
    filters: List[FieldFilter] = []
    group_by: Optional[List[str]] = None
    sort: List[SortSpec] = [SortSpec(field="loan_amount", direction="desc")]
    limit: int = Field(default=25, le=200)
    page: int = Field(default=1, ge=1)

class DrilldownRequest(AnalyticsFilterRequest):
    metric_context: Optional[str] = None  # "status:submitted", "program:dscr"
    columns: Optional[List[str]] = None   # which

class SavedView(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    filter_state: AnalyticsFilterRequest
    role_preset: Optional[str]
    is_shared: bool
    created_by: UUID
    created_at: datetime

Multi-tenant and RBAC enforcement

Every query in analytics_repo.py receives the current user and applies:

1. WHERE loans.tenant_id = current_user.tenant_id — always first, always present.
2. Role-scoped row filtering:
  - Broker: AND l.id IN (SELECT loan_id FROM loan_parties WHERE party_id = $broker_party_id AND role = 'broker')
  - AE: same pattern with role = 'account_executiv
erwriter/Processor: AND l.assigned_to = current_user.id OR loan_parties membership
  - Admin/Manager: no additional row filter

These two layers are non-negotiable and live in analytics_repo.py, not in route handlers. The route handler only resolves the current user and passes it to the service.

---
6. PostgreSQL Architecture

Direct SQL vs Views vs Materialized Views

┌──────────────────────────────┬──────────────────────────┬──────────────────────────────────────────────────────────────┐
│           Scenario           │         Approach         │                             Why                              │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ KPI card values (count, sum) │ Direct SQL with indexes  │ Fast, always fresh, parameterized                            │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Status distribution          │ Direct SQL               │ Simple GROUP BY, well-indexed                                │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Aging by status              │ Direct SQL with CTE      │ DISTINCT ON pattern, efficient with loan_status_events index │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Monthly trend (12 months)    │ Direct SQL               │ Date truncation over submitted_at, indexed                   │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Channel mix                  │ Direct SQL               │ Simple GROUP BY on indexed column                            │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Open conditions per loan     │ Direct SQL with subquery │ Conditions table is small, tenant-scoped                     │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Loan owner capacity          │ Direct SQL               │ Aggregate on assigned_to                                     │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Materialized view            │ Not yet                  │ Add only when p99 query time exceeds 200ms on real traffic   │
└──────────────────────────────┴──────────────────────────┴──────────────────────────────────────────────────────────────┘

The only time to reach for a materialized view is when an aggregate query is slow and slight staleness is acceptable (e.g., a management report that refreshes hourly). For a 200-loan seed with realistic growth to a few thousand loans per tenant, direct SQL with proper indexes will be sufficient for 12–18 months.

Indexing strategy

Principle: index by (tenant_id, ...) as the leading column on every analytics-relevant table. The tenant filter is always in the WHERE clause and cuts the scan to a fraction of the table.

Existing indexes that cover analytics:
- idx_loans_tenant_status → (tenant_id, status) — covers status distribution
- idx_loans_tenant_assigned → (tenant_id, assigned_to) — covers workload queries
- idx_loans_tenant_created → (tenant_id, created_at DESC) — covers recency sorts
- idx_loans_closing_date partial — covers funding pipeline
- idx_loans_funding_date partial — covers funded M
- idx_loan_status_events → (tenant_id, loan_id, occurred_at DESC) — covers aging
- idx_conditions_tenant_loan → (tenant_id, loan_id) — covers condition aggregates
- idx_exceptions_tenant_status → (tenant_id, status, created_at DESC) — covers exception KPIs

New indexes needed for analytics:

-- Monthly submission trend: date_trunc('month', submitted_at)
CREATE INDEX IF NOT EXISTS idx_loans_tenant_submitted
  ON loans (tenant_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

-- Loan program distribution
CREATE INDEX IF NOT EXISTS idx_loans_tenant_program
  ON loans (tenant_id, loan_program)
  WHERE loan_program IS NOT NULL;

-- Loan purpose
CREATE INDEX IF NOT EXISTS idx_loans_tenant_purpos
oans (tenant_id, purpose);

-- loan_financials: amount aggregates (volume by status needs amount + status join)
CREATE INDEX IF NOT EXISTS idx_loan_financials_tenant_amount
  ON loan_financials (tenant_id, loan_amount)
  WHERE loan_amount IS NOT NULL;

-- conditions by status (open count, submitted count)
CREATE INDEX IF NOT EXISTS idx_conditions_tenant_status
  ON conditions (tenant_id, status);

-- exceptions by tenant + severity + status
-- idx_exceptions_tenant_status already exists from 118_exceptions_v2

What not to index:
- loans.loan_number — text lookup, already covered by the unique partial index.
- loan_financials.fico_score, ltv, dscr — not yet high-frequency filter fields. Add when a query pattern requires them.
- JSONB columns (product_data, loan_snapshot) — do not index unless a specific key is queried consistently. GIN indexes on JSONB are expensive and rarely worth it.
- Boolean columns in isolation (interest_rate_locked) — cardinality too low; a partial index is the right approach if needed.

Key SQL patterns for analytics

Count by status:
SELECT l.status, COUNT(*) AS loan_count
FROM loans l
WHERE l.tenant_id = :tenant_id
  AND l.status NOT IN ('denied','withdrawn','cancelled')
GROUP BY l.status
ORDER BY loan_count DESC;

Volume by status (requires satellite join):
SELECT l.status, COALESCE(SUM(lf.loan_amount), 0) AS total_amount
FROM loans l
JOIN loan_financials lf ON lf.loan_id = l.id
WHERE l.tenant_id = :tenant_id
GROUP BY l.status;

Monthly submissions (12-month window):
SELECT
  date_trunc('month', l.submitted_at) AS month,
  COUNT(*) AS submissions
FROM loans l
WHERE l.tenant_id = :tenant_id
  AND l.submitted_at >= now() - interval '12 months'
GROUP BY 1
ORDER BY 1;

Aging by current status (time in current status):
WITH latest_entry AS (
  SELECT DISTINCT ON (loan_id)
    loan_id, occurred_at
  FROM loan_status_events
  WHERE tenant_id = :tenant_id
  ORDER BY loan_id, occurred_at DESC
)
SELECT
  l.status,
  ROUND(AVG(EXTRACT(EPOCH FROM (now() - le.occurreAS avg_days,
EXTRACT(EPOCH FROM (now() - le.occurred_at)) / 86400)::int AS max_days,
  COUNT(*) AS loan_count
FROM loans l
JOIN latest_entry le ON le.loan_id = l.id
WHERE l.tenant_id = :tenant_id
  AND l.status NOT IN ('funded','closed','denied','withdrawn','cancelled')
GROUP BY l.status;

Open conditions per loan (for action-needed KPI):
SELECT l.id, COUNT(c.id) AS open_conditions
FROM loans l
JOIN conditions c ON c.loan_id = l.id AND c.tenant_id = l.tenant_id
WHERE l.tenant_id = :tenant_id
  AND c.status = 'open'
  AND l.status NOT IN ('funded','closed','denied','withdrawn','cancelled')
GROUP BY l.id
HAVING COUNT(c.id) > 0;

Stale files (no update in 72h):
SELECT id, loan_number, status, updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at)) / 3600 AS hours_stale
FROM loans
WHERE tenant_id = :tenant_id
  AND status NOT IN ('funded','closed','denied','withdrawn','cancelled')
  AND updated_at < now() - interval '72 hours'
ORDER BY updated_at ASC;

SLA breach detection (in conditions_review > 5 days):
WITH status_entry AS (
  SELECT DISTINCT ON (loan_id)
    loan_id, occurred_at
  FROM loan_status_events
  WHERE tenant_id = :tenant_id
    AND to_status = 'conditions_review'
  ORDER BY loan_id, occurred_at DESC
)
SELECT l.id, l.loan_number,
  EXTRACT(DAY FROM (now() - se.occurred_at))::int AS days_in_review
FROM loans l
JOIN status_entry se ON se.loan_id = l.id
WHERE l.tenant_id = :tenant_id
  AND l.status = 'conditions_review'
  AND now() - se.occurred_at > interval '5 days';

EXPLAIN / ANALYZE process

Before shipping any analytics query, run:
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
<the query with representative values>;

Red flags to fix before shipping:
- Seq Scan on loans or conditions without a filter → missing index
- Hash Join on large tables → ensure the smaller side is filtered first
- Sort with large rows → add index on the sort column

---
ry Builder Design

Safety contract

The frontend sends a structured filter object. The backend never interpolates user values into SQL strings. All field names and operators are validated against whitelists before any SQL is constructed. SQLAlchemy's parameterized query builder is used for all value injection.

Allowed filter fields (analytics_filters.py)

ALLOWED_FILTER_FIELDS = {
    # loans table
    "status":          {"column": "l.status",          "type": "enum",    "values": LOAN_STATUS_VALUES},
    "purpose":         {"column": "l.purpose",         "type": "enum",    "values": LOAN_PURPOSE_VALUES},
    "loan_program":    {"column": "l.loan_program",    "type": "text"},
    "loan_product":    {"column": "l.loan_product",    "type": "text"},
    "occupancy_type":  {"column": "l.occupancy_type",  "type": "enum",    "values": OCCUPANCY_VALUES},
    "submitted_at":    {"column": "l.submitted_at",    "type": "date"},
    "funding_date":    {"column": "l.funding_date",    "type": "date"},
    "closing_date":    {"column": "l.closing_date",    "type": "date"},
    "assigned_to":     {"column": "l.assigned_to",     "type": "uuid"},
    # loan_financials (require join)
    "loan_amount":     {"column": "lf.loan_amount",    "type": "numeric", "requires_join": "loan_financials"},
    "ltv":             {"column": "lf.ltv",            "type": "numeric", "requires_join": "loan_financials"},
    "fico_score":      {"column": "lf.fico_score",     "type": "integer", "requires_join": "loan_financials"},
    "dscr":            {"column": "lf.dscr",           "type": "numeric", "requires_join": "loan_financials"},
    "dti":             {"column": "lf.debt_to_income", "type": "numeric", "requires_join": "loan_financials"},
}

ALLOWED_OPERATORS = {
    "eq": "=",
    "neq": "!=",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
    "in": "IN",
    "not_in": "NOT IN",
    "is_null": "IS NULL",
    "is_not_null": "IS NOT NULL",
}

Date preset resolution

def resolve_date_preset(preset: DatePreset, field:
    today = date.today()
    match preset:
        case DatePreset.TODAY:
            return today, today
        case DatePreset.LAST_7_DAYS:
            return today - timedelta(days=7), today
        case DatePreset.LAST_30_DAYS:
            return today - timedelta(days=30), today
        case DatePreset.THIS_MONTH:
            return today.replace(day=1), today
        case DatePreset.LAST_MONTH:
            first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
            last = today.replace(day=1) - timedelta(days=1)
            return first, last
        case DatePreset.THIS_QUARTER:
      q_start_month = ((today.month - 1) // 3) * 3 + 1
            return today.replace(month=q_start_month, day=1), today
        case DatePreset.YEAR_TO_DATE:
            return today.replace(month=1, day=1), today

Filter object (canonical shape — same for frontend and backend)

interface AnalyticsFilter {
  dateRange?: {
    field: "submitted_at" | "funding_date" | "closing_date" | "created_at";
    preset: DatePreset;
    fromDate?: string;   // ISO date, only when preset = "custom"
    toDate?: string;
  };
  filters: Array<{
    field: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "is_null" | "is_not_null";
    value?: string | number | string[] | number[];
  }>;
  sort: Array<{ field: string; direction: "asc" | "desc" }>;
  limit: number;
  page: number;
}

Saved filter presets

Saved presets are stored via POST /analytics/saved-views. They persist the entire AnalyticsFilter object plus a human name. On load, the preset is injected into the filter bar and URL state. Role-scoped presets can be shared across team members. This is the only form of "personalization" to build in Phase 4 — no chart re-ordering, no layout customization.

---
8. Frontend Architecture

Component tree

pages/analytics/index.tsx          ← AnalyticsPage (route)
  AnalyticsFilterBar                ← global filter + active chips + saved views
    DateRangePickerPopover
    MultiSelectDropdown (status, program, purpose)
    UserSelectDropdown (assigned_to)
    ActiveFilterChips               ← visual displ
    SavedViewsDropdown
  AnalyticsRolePreset               ← resolves which KPIs + charts to show for role
  KpiStrip
    MetricCard × N                  ← click → trig
  ChartGrid
    ChartCard (StatusCount)         ← Recharts bar, click → drilldown
    ChartCard (StatusVolume)
    ChartCard (ChannelMix)
    ChartCard (AgingByStatus)
    ChartCard (MonthlyTrend, wide)
  DrilldownPanel                    ← slides up when drilldown active
    DrilldownTable
      DrilldownTableRow × N         ← click → opens SidePanel
    PaginationControls
    ExportButton
  LoanSidePanel                     ← slide-over, shows when row clicked
    LoanSidePanelHeader
onditionsSummary
    OpenInWorkspaceLink
  QueryBuilderPanel                 ← advanced filter drawer (Phase 5)

State management

┌───────────────────────┬───────────────────────────────────────────────────┬────────────────────────────────────────────────┐
│      State layer      │                   What it holds                   │                      Why                       │
├───────────────────────┼───────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ URL query params      │ Active filters (serialized), drilldown context,   │ Shareable links, back-button works             │
│                       │ saved view ID                                     │                                                │
├───────────────────────┼───────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ Local component state │ Popover open/close, in-progress filter edits      │ Avoid polluting URL on every keystroke         │
│                       │ before Apply                                      │                                                │
├───────────────────────┼───────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ React Query (server   │ summary response, drilldown response, saved-views │ Caching, background refetch, deduplication     │
│ state)                │  list                                             │                                                │
├───────────────────────┼───────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ Context (auth)        │ Current user + role                               │ Used by AnalyticsRolePreset to select the      │
│                       │                                                   │ metric preset                                  │
└───────────────────────┴───────────────────────────────────────────────────┴────────────────────────────────────────────────┘

URL design:
/analytics?date_preset=last_30_days&status=submitted,conditions_review&drilldown=status:submitted&page=1

React Query keys:
const summaryKey = ["analytics", "summary", filterState] as const;
const drilldownKey = ["analytics", "drilldown", drilldownContext, filterState, page] as const;
const savedViewsKey = ["analytics", "saved-views"] as const;

AnalyticsRolePreset

A config object per role that defines which KPI IDs to render, which charts to render, and any additional default filter the role always gets (e.g., broker role always gets filters: [{field: "assigned_broker_party_id", operator: "eq", value: currentUser.partyId}]). This is a frontend concern — the backend enforces row-level isolation independently.

const ROLE_PRESETS: Record<UserRole, RolePreset> = {
  manager: {
    kpis: ["total_active_loans", "pipeline_volume", "sla_breach_count", "funded_mtd", "open_exceptions"],
    charts: ["status_count", "aging_by_status", "monthly_submissions", "loans_by_owner"],
    defaultFilters: [],
  },
  underwriter: {
    kpis: ["my_queue_count", "submitted_conditions", "open_exceptions", "oldest_file_age"],
    charts: ["status_count", "aging_by_status", "channel_mix"],
    defaultFilters: [{ field: "assigned_to", operator: "eq", value: "$currentUserId" }],
  },
  // etc.
};

Skeletons and empty states

- LoadingSpinner is replaced by a KpiStripSkeletonut-preserving placeholders that match the expectedcard sizes. Prevents layout shift.
- EmptyState is shown when a chart has no data for the current filters, with a clear explanation ("No loans submitted in this date range") and a "Clear filters" CTA.
- ErrorState shows with a retry action — same component already used in the current analytics page.

---
9. Implementation Phases

Phase 1 — Backend-backed summary metrics (no filters yet)

Goal: replace listLoans() as the data source for the analytics page. The page calls GET /analytics/summary instead of fetching all loans and computing in the frontend.

Backend:
- Create src/backend/app/api/v1/analytics.py with a single GET /summary route.
- Create src/backend/app/services/analytics_repo.py with the five KPI queries and five chart aggregates, all hard-coded to the current user's tenant.
- Create src/backend/app/schemas/analytics_schema.py with the SummaryResponse shape.
- Register the router in core/main.py.
- Migration 129_analytics_indexes.sql with the new indexes listed in Section 6.

Frontend:
- Add analyticsService.ts in src/frontend/src/services/ with a getSummary() function calling apiClient.
- Replace pipelineAnalytics.ts frontend computation with a hook useAnalyticsSummary() using React Query.
- Update analytics/index.tsx to call the hook.
- Remove buildPipelineKpis, buildStatusCountData, etc. from the frontend — these move to the backend.

Done when: the analytics page loads real PostgreSQL data and the frontend does zero aggregation.

---
Phase 2 — Global filters + URL state

 add the filter bar. All metrics and charts re-fetch when filters change.

- Build AnalyticsFilterBar component.
- Implement URL serialization: useAnalyticsFilters() hook reads/writes query params.
- getSummary() accepts AnalyticsFilterRequest and passes query params to GET /analytics/summary.
- Backend resolves date presets and applies field filters using the whitelist validator.
- ActiveFilterChips shows applied filters as removable chips.

Done when: changing status or date range in the filter bar updates all KPI cards and all charts.

---
Phase 3 — Drill-down loan table

Goal: every KPI card and every chart bar is clickable and reveals the underlying loans.

- Add POST /analytics/drilldown endpoint.
- DrilldownPanel component, triggered by onClick on MetricCard and ChartCard.
- Drilldown context is encoded in URL: ?drilldown=status:submitted.
- DrilldownTable renders paginated rows with sortable columns.
- Clicking a row opens LoanSidePanel (reuse the slide-over pattern from the loan workspace if it exists).

Done when: clicking "14 open conditions" opens a paginated table of the 14 loans, and clicking any row shows a loan summary.

---
Phase 4 — Saved views

Goal: users can name and save their current filter state and recall it from a dropdown.

- Migration 130_analytics_saved_views.sql — new table: analytics_saved_views(id, tenant_id, created_by, name, description, filter_state jsonb, role_preset text, is_shared bool, created_at, updated_at).
- GET/POST/PATCH/DELETE /analytics/saved-views endpoints.
- SavedViewsDropdown in the filter bar.
- Loading a saved view applies the full filter state and updates the URL.

Done when: a manager can save "My SLA Risk View" and share it with the team.

---
Phase 5 — Query builder panel (advanced filters)

Goal: power users can filter by FICO range, LTV, DSCR, date ranges on multiple fields, using the structured filter UI.

ryBuilderPanel drawer component with field selector, operator dropdown, value input.
- Frontend validation: only ALLOWED_FILTER_FIELDS are offered in the dropdown.
- Supports adding/removing filter rows.
- Connects to the same AnalyticsFilterRequest shape used in Phases 2–4.

Done when: an underwriter can filter the dashboard to "FICO < 660 AND DSCR < 1.10 AND status = conditions_review" and see the specific high-risk file queue.

---
Phase 6 — Performance optimization (materialized views)

Done at: p99 analytics query time exceeds 200ms on real tenant traffic, or when tenant pipeline sizes grow to 5,000+ active loans.

- Profile with EXPLAIN ANALYZE on the slowest queries.
- Candidates for materialized views: monthly trend (refreshed hourly), aging summary (refreshed every 15 minutes), loan-program distribution.
- Add pg_cron or application-level refresh via a background task — do not do this before a real performance problem exists.

---
Phase 7 — Role-specific dashboards (Manager + Underwriter deep dive)

Goal: manager gets a team workload heatmap and per-user capacity view. Underwriter gets a focused queue dashboard separate from the tenant-wide analytics page.

- AnalyticsRolePreset is fully implemented per role.
- Manager dashboard includes loans_by_owner chart (new chart type: grouped bar by assignee × status).
- Underwriter dashboard includes conditions aging breakdown per loan in their queue.
- Export is role-scoped: brokers can only export their own files.

---
10. Deliverables

File and folder additions

src/backend/app/
  api/v1/analytics.py
  services/analytics_repo.py
  schemas/analytics_schema.py
  core/analytics_filters.py       ← whitelist + filter builder

db/migrations/
  129_analytics_indexes.sql       ← new indexes from Section 6
  130_analytics_saved_views.sql   ← saved views table (Phase 4)

src/frontend/src/
  services/analyticsService.ts    ← getSummary(), getDrilldown(), export
  hooks/useAnalyticsSummary.ts    ← React Query wrapper
  hooks/useAnalyticsDrilldown.ts
  hooks/useAnalyticsFilters.ts    ← URL ↔ filter state sync
  components/analytics/
    AnalyticsFilterBar.tsx
    ActiveFilterChips.tsx
    KpiStrip.tsx
    MetricCard.tsx
    ChartCard.tsx
illdownPanel.tsx
    DrilldownTable.tsx
    LoanSidePanel.tsx
    SavedViewsDropdown.tsx
    QueryBuilderPanel.tsx         ← Phase 5
    AnalyticsRolePreset.tsx
    KpiStripSkeleton.tsx
    ChartGridSkeleton.tsx
  types/analytics.ts              ← AnalyticsFilter, SummaryResponse, DrilldownResponse, SavedView
  pages/analytics/index.tsx       ← updated to use new components

API contract summary

┌─────────────────────────────┬────────┬─────────────────┬───────────────────────────────┐
│          Endpoint           │ Method │      Auth       │            Returns            │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/summary          │ GET    │ JWT, all roles  │ SummaryResponse               │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/drilldown        │ POST   │ JWT, all roles  │ DrilldownResponse (paginated) │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/saved-views      │ GET    │ JWT, all roles  │ List[SavedView]               │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/saved-views      │ POST   │ JWT, all roles  │ SavedView                     │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/saved-views/{id} │ PATCH  │ JWT, owner only │ SavedView                     │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/saved-views/{id} │ DELETE │ JWT, owner only │ 204                           │
├─────────────────────────────┼────────┼─────────────────┼───────────────────────────────┤
│ /analytics/export           │ POST   │ JWT, all roles  │ CSV stream                    │
└─────────────────────────────┴────────┴─────────────────┴───────────────────────────────┘

Implementation checklist (Phase 1 → 3)

- [ ] 129_analytics_indexes.sql — submitted_at, loan_program, purpose, conditions.status indexes
- [ ] analytics_schema.py — SummaryResponse, DrilldownRequest, DrilldownResponse
- [ ] analytics_filters.py — ALLOWED_FILTER_FIELDS, ALLOWED_OPERATORS, date preset resolver
- [ ] analytics_repo.py — 5 KPI queries, 5 chart aggregate queries, drilldown query
- [ ] analytics.py router — GET /summary, POST /drilldown, register in main.py
- [ ] analyticsService.ts — getSummary(), getDrilldown()
- [ ] useAnalyticsSummary / useAnalyticsDrilldown hooks with React Query
- [ ] useAnalyticsFilters — URL ↔ filter state syn
- [ ] AnalyticsFilterBar, ActiveFilterChips
- [ ] MetricCard — click triggers drilldown context
- [ ] ChartCard — click triggers drilldown context
- [ ] DrilldownPanel, DrilldownTable, pagination
- [ ] LoanSidePanel slide-over
- [ ] KpiStripSkeleton, ChartGridSkeleton loading states
- [ ] Remove buildPipelineKpis and all frontend aggregation from pipelineAnalytics.ts
- [ ] Update analytics/index.tsx to use new component tree
- [ ] RBAC enforcement in analytics_repo.py (tenant + role scoping)
                                                                                                                             Risks and tradeoffs

┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────┐
│                       Risk                       │                                Mitigation                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ loan_financials join on every summary request    │ Covered by idx_loan_financials_tenant; monitor query time                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ loan_status_events aging CTE gets slow as events │ Add idx_loan_status_events covering (tenant_id, loan_id, occurred_at     │
│  accumulate                                      │ DESC) — already exists                                                   │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ Frontend React Query cache serving stale KPIs    │ Set staleTime: 60_000 (1 min), show computed_at timestamp in header      │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ Export endpoint abused for mass data extraction  │ Cap at 5,000 rows, require explicit role permission (it_admin or manager │
│                                                  │  for full exports)                                                       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ Saved views containing invalid field names after │ Version the filter_state JSON; validate on load and surface a "this view │
│  a schema change                                 │  needs updating" warning                                                 │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ Over-building query builder before users need it │ Defer Phase 5 until at least one role has asked for a filter not         │
│                                                  │ available in the standard bar                                            │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────┘

What not to build yet

- Scheduled reports / email delivery — not needed until the platform has a stable user base requesting it.
- Chart customization / drag-and-drop — this is a BI tool feature. Origina's users need fast answers, not chart editors.
- Cross-tenant benchmarking — introduces multi-tenant data leakage risk; out of scope entirely.
- Predictive analytics / ML scoring — explicitly out of scope per product brief.
- Real-time push updates (WebSocket) — a 60-second React Query stale time with a manual refresh button is sufficient for this workflow.
- Materialized views — do not add until Phase 6 conditions are met. Pre-optimizing adds migration complexity and operational overhead before there is a measured problem.
- Custom chart types — Recharts bar/line/pie covers everything in the catalog. No new chart libraries.
- Annotations / comments on charts — future feature; out of scope for Year 1.

---
Architecture summary

The path from here to a production analytics workspace is a clean seven-phase progression. Phase 1 alone — moving aggregation from the frontend to the backend — eliminates the fundamental architectural flaw (loading all loans to compute counts in TypeScript) and sets the foundation for everything else. Phases 2 and 3 deliver the operational value: filters and drill-down. Everything after that is enhancement, not foundation. Build Phases 1–3 first, ship them to real users, and let actual workflow patterns drive Phases 4–7.