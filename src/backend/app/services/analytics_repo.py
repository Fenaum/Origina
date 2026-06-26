"""
Analytics service layer — all SQL lives here.

Conventions:
  - Every query filters by tenant_id first; role-based row filters are appended
    via the `extra_where` / `extra_params` mechanism in `build_filter()`.
  - Values are bound via SQLAlchemy params; column names come exclusively from
    the whitelists in `app.core.analytics_filters`.
  - All money math is performed in SQL (SUM, AVG) on NUMERIC columns — Python
    only formats the result for display.
  - All time math (aging, "submitted this month", SLA breach) is performed in
    SQL using the server's `now()` to avoid client/server clock drift.

See docs/architecture/dashboard.md Section 6 (PostgreSQL Architecture) for
the SQL patterns catalog and the indexing strategy that backs these queries.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.analytics_filters import (
    ACTIVE_STATUSES,
    INACTIVE_STATUSES,
    LOAN_STATUS_LABELS,
    build_filter,
    render_sort_clause,
    summarize_filter,
)
from app.models.loan import LoanStatus
from app.schemas.analytics_schema import (
    ActionNeededSummary,
    AgingByStatusDatum,
    AnalyticsCharts,
    AnalyticsFilterRequest,
    AnalyticsMeta,
    ChannelMixDatum,
    DrilldownMeta,
    DrilldownRequest,
    DrilldownResponse,
    DrilldownRow,
    KpiCard,
    MonthlySubmissionDatum,
    StatusCountDatum,
    StatusVolumeDatum,
    SummaryResponse,
)


# ── Role-scoped row filters ──────────────────────────────────────────────────

def _role_filter_clauses(current_user) -> tuple[list[str], dict[str, Any]]:
    """
    Apply role-based row restrictions on top of the tenant filter.

    Conventions (see Section 5 of dashboard.md):
      - broker/seller: only loans where this user is the broker in loan_parties
      - underwriter / processor: loans assigned_to current_user
      - account_manager: no row restriction (sees everything in the tenant)
      - it_admin: no row restriction
      - loan_officer: assigned_to self OR loans they originated

    For now, we scope by `assigned_to = current_user.id` when the user holds
    a single non-admin role. The full role-preset mapping is a Phase 7 deliverable.
    """
    role_names = {ur.role.name for ur in getattr(current_user, "roles", [])}

    # Admins / account managers see everything in the tenant.
    if {"it_admin", "account_manager"} & role_names:
        return [], {}

    # Everyone else is scoped to loans assigned to them. Brokers/sellers with a
    # party link use a tighter loan_parties filter — that path lands in Phase 7
    # when the broker party_id column is consistently populated in user_parties.
    return ["l.assigned_to = :scoped_user_id"], {"scoped_user_id": current_user.id}


# ── Meta ─────────────────────────────────────────────────────────────────────

def _build_meta(db: Session, request: AnalyticsFilterRequest, tenant_id: UUID) -> AnalyticsMeta:
    return AnalyticsMeta(
        computed_at=datetime.now(timezone.utc),
        tenant_id=tenant_id,
        filter_summary=summarize_filter(request),
    )


# ── KPI queries ──────────────────────────────────────────────────────────────

def _kpi_total_active_loans(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> tuple[int, int]:
    """
    Returns (active_count, total_count).
    Total count is the detail ("3 added today" can be derived separately).
    """
    extra_where, extra_params = _role_filter_clauses(current_user)
    # The active KPI excludes terminal/inactive statuses by definition — we
    # inject that exclusion directly so it composes with the user filters.
    base_clauses = extra_where + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
    ]
    bf = build_filter(request, tenant_id=tenant_id, extra_where=base_clauses, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)

    sql = f"""
        SELECT COUNT(*) AS active_count
        FROM loans l
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
    """
    row = db.execute(text(sql), bf.where_params).mappings().one()
    return int(row["active_count"]), 0


def _kpi_pipeline_volume(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> tuple[float, int]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    base_clauses = extra_where + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
    ]
    bf = build_filter(request, tenant_id=tenant_id, extra_where=base_clauses, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)

    sql = f"""
        SELECT
            COALESCE(SUM(lf.loan_amount), 0) AS total_amount,
            COUNT(*)                          AS loan_count
        FROM loans l
        LEFT JOIN loan_financials lf ON lf.loan_id = l.id
        WHERE {where_sql}
    """
    row = db.execute(text(sql), bf.where_params).mappings().one()
    return float(row["total_amount"]), int(row["loan_count"])


def _kpi_submitted_this_month(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> int:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    # Append a "this month" submitted_at window — independent of the user's date range filter
    # so the KPI always reflects the current calendar month.
    base_clauses = bf.where_clauses + [
        "l.submitted_at >= date_trunc('month', now())",
        "l.submitted_at <  date_trunc('month', now()) + interval '1 month'",
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"SELECT COUNT(*) AS n FROM loans l {chr(10).join(bf.joins)} WHERE {where_sql}"
    return int(db.execute(text(sql), bf.where_params).scalar() or 0)


def _kpi_funded_mtd(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> tuple[float, int]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "l.status = 'funded'",
        "l.funding_date >= date_trunc('month', now())",
        "l.funding_date <  date_trunc('month', now()) + interval '1 month'",
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"""
        SELECT
            COALESCE(SUM(lf.loan_amount), 0) AS total_amount,
            COUNT(*)                          AS loan_count
        FROM loans l
        LEFT JOIN loan_financials lf ON lf.loan_id = l.id
        WHERE {where_sql}
    """
    row = db.execute(text(sql), bf.where_params).mappings().one()
    return float(row["total_amount"]), int(row["loan_count"])


def _kpi_open_conditions(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> int:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"""
        SELECT COUNT(c.id) AS n
        FROM loans l
        LEFT JOIN conditions c
          ON c.loan_id = l.id AND c.tenant_id = l.tenant_id AND c.status = 'open'
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
    """
    return int(db.execute(text(sql), bf.where_params).scalar() or 0)


def _kpi_open_exceptions(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> int:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "e.status IN ('open','submitted','under_review','additional_info_requested')"
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"""
        SELECT COUNT(e.id) AS n
        FROM loans l
        LEFT JOIN exceptions e
          ON e.loan_id = l.id AND e.tenant_id = l.tenant_id
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
    """
    return int(db.execute(text(sql), bf.where_params).scalar() or 0)


def _kpi_stale_files(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> int:
    """Loans active but untouched for > 72 hours."""
    extra_where, extra_params = _role_filter_clauses(current_user)
    base_clauses = extra_where + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')",
        "l.updated_at < now() - interval '72 hours'",
    ]
    bf = build_filter(request, tenant_id=tenant_id, extra_where=base_clauses, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)
    sql = f"SELECT COUNT(*) AS n FROM loans l {chr(10).join(bf.joins)} WHERE {where_sql}"
    return int(db.execute(text(sql), bf.where_params).scalar() or 0)


def _kpi_sla_breaches(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> int:
    """
    Loans in submitted or conditions_review for > 5 days with no terminal
    activity. A correlated subquery finds the timestamp of the most recent
    entry into the loan's current status via loan_status_events — this
    correctly handles loans that re-entered the same status.
    """
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "l.status IN ('submitted','conditions_review')",
        """now() > (
            SELECT MAX(lse.occurred_at) + interval '5 days'
            FROM loan_status_events lse
            WHERE lse.loan_id = l.id
              AND lse.tenant_id = l.tenant_id
              AND lse.to_status = l.status
        )""",
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"SELECT COUNT(*) AS n FROM loans l {chr(10).join(bf.joins)} WHERE {where_sql}"
    return int(db.execute(text(sql), bf.where_params).scalar() or 0)


# ── Chart aggregates ─────────────────────────────────────────────────────────

def _chart_status_count(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> list[StatusCountDatum]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)
    sql = f"""
        SELECT l.status, COUNT(*) AS n
        FROM loans l
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
        GROUP BY l.status
        ORDER BY n DESC
    """
    rows = db.execute(text(sql), bf.where_params).mappings().all()
    return [
        StatusCountDatum(
            status=r["status"],
            label=LOAN_STATUS_LABELS.get(r["status"], r["status"]),
            count=int(r["n"]),
        )
        for r in rows
    ]


def _chart_status_volume(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> list[StatusVolumeDatum]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)
    sql = f"""
        SELECT l.status, COALESCE(SUM(lf.loan_amount), 0) AS total_amount
        FROM loans l
        LEFT JOIN loan_financials lf ON lf.loan_id = l.id
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
        GROUP BY l.status
        ORDER BY total_amount DESC
    """
    rows = db.execute(text(sql), bf.where_params).mappings().all()
    return [
        StatusVolumeDatum(
            status=r["status"],
            label=LOAN_STATUS_LABELS.get(r["status"], r["status"]),
            total_amount=r["total_amount"] or 0,
        )
        for r in rows
    ]


def _chart_channel_mix(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> list[ChannelMixDatum]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)
    sql = f"""
        SELECT l.loan_program, COUNT(*) AS n
        FROM loans l
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
          AND l.loan_program IS NOT NULL
        GROUP BY l.loan_program
        ORDER BY n DESC
    """
    rows = db.execute(text(sql), bf.where_params).mappings().all()
    total = sum(int(r["n"]) for r in rows) or 1
    return [
        ChannelMixDatum(
            program=r["loan_program"],
            label=r["loan_program"].replace("_", " ").title() if r["loan_program"] else "Other",
            count=int(r["n"]),
            pct=round(100 * int(r["n"]) / total, 1),
        )
        for r in rows
    ]


def _chart_monthly_submissions(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> list[MonthlySubmissionDatum]:
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    where_sql = " AND ".join(bf.where_clauses)
    sql = f"""
        SELECT
            date_part('year',  l.submitted_at)::int AS year,
            date_part('month', l.submitted_at)::int AS month,
            COUNT(*) AS n
        FROM loans l
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
          AND l.submitted_at IS NOT NULL
          AND l.submitted_at >= now() - interval '12 months'
        GROUP BY 1, 2
        ORDER BY 1, 2
    """
    rows = db.execute(text(sql), bf.where_params).mappings().all()
    month_labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return [
        MonthlySubmissionDatum(
            year=int(r["year"]),
            month=int(r["month"]),
            label=f"{month_labels[int(r['month']) - 1]} {int(r['year'])}",
            count=int(r["n"]),
        )
        for r in rows
    ]


def _chart_aging_by_status(db: Session, request: AnalyticsFilterRequest, *, tenant_id: UUID, current_user) -> list[AgingByStatusDatum]:
    """
    Time in current status. The CTE picks the most recent status event per loan
    (DISTINCT ON), then we compute AVG/MAX days since that timestamp.

    The CTE deliberately uses 'completed=False' style implicit filter via
    `to_status = l.status` — we want the timestamp of the entry into the
    *current* status, not the most recent event of any kind.
    """
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"""
        WITH latest_entry AS (
            SELECT DISTINCT ON (loan_id)
                loan_id, occurred_at
            FROM loan_status_events
            WHERE tenant_id = :tenant_id
            ORDER BY loan_id, occurred_at DESC
        )
        SELECT
            l.status,
            ROUND(
                AVG(EXTRACT(EPOCH FROM (now() - le.occurred_at)) / 86400)::numeric,
                2
            )::float AS avg_days,
            MAX(EXTRACT(EPOCH FROM (now() - le.occurred_at)) / 86400)::int AS max_days,
            COUNT(*) AS loan_count
        FROM loans l
        JOIN latest_entry le ON le.loan_id = l.id
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
        GROUP BY l.status
        ORDER BY avg_days DESC
    """
    rows = db.execute(text(sql), bf.where_params).mappings().all()
    return [
        AgingByStatusDatum(
            status=r["status"],
            label=LOAN_STATUS_LABELS.get(r["status"], r["status"]),
            avg_days=float(r["avg_days"] or 0),
            max_days=int(r["max_days"] or 0),
            loan_count=int(r["loan_count"]),
        )
        for r in rows
    ]


def _chart_action_needed(
    db: Session,
    request: AnalyticsFilterRequest,
    *,
    tenant_id: UUID,
    current_user,
) -> ActionNeededSummary:
    """
    Single round-trip rollup of the four "needs attention" buckets.

    Each subquery filters to active loans only; tenant + user role filters
    are applied to the loans table in the outer WHERE.
    """
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)
    base_clauses = bf.where_clauses + [
        "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
    ]
    where_sql = " AND ".join(base_clauses)
    sql = f"""
        SELECT
            COUNT(*) FILTER (WHERE c_open.id IS NOT NULL)                  AS open_conditions,
            COUNT(*) FILTER (WHERE c_sub.id IS NOT NULL)                   AS submitted_conditions,
            COUNT(*) FILTER (WHERE e_open.id IS NOT NULL)                  AS open_exceptions,
            COUNT(*) FILTER (WHERE l.updated_at < now() - interval '72 hours') AS stale_files
        FROM loans l
        LEFT JOIN conditions c_open ON c_open.loan_id = l.id AND c_open.tenant_id = l.tenant_id AND c_open.status = 'open'
        LEFT JOIN conditions c_sub  ON c_sub.loan_id  = l.id AND c_sub.tenant_id  = l.tenant_id AND c_sub.status  = 'submitted'
        LEFT JOIN exceptions e_open ON e_open.loan_id = l.id AND e_open.tenant_id = l.tenant_id
                                    AND e_open.status IN ('open','submitted','under_review','additional_info_requested')
        {chr(10).join(bf.joins)}
        WHERE {where_sql}
    """
    row = db.execute(text(sql), bf.where_params).mappings().one()
    return ActionNeededSummary(
        open_conditions=int(row["open_conditions"] or 0),
        submitted_conditions=int(row["submitted_conditions"] or 0),
        open_exceptions=int(row["open_exceptions"] or 0),
        stale_files=int(row["stale_files"] or 0),
    )


# ── Drill-down ───────────────────────────────────────────────────────────────

# metric_context values that map to a single hard WHERE clause. Anything not
# in this map is interpreted as "field:value" using the whitelist.
_METRIC_CONTEXT_TO_WHERE: dict[str, tuple[str, Any]] = {
    "open_conditions":            ("open_conditions",  True),  # special — see below
    "submitted_conditions":       ("submitted_conditions", True),
    "open_exceptions":            ("open_exceptions", True),
    "stale_files":                ("stale_files", True),
}


def drilldown_loans(
    db: Session,
    request: DrilldownRequest,
    *,
    tenant_id: UUID,
    current_user,
) -> DrilldownResponse:
    """
    Return the paginated list of loans that produced a KPI or chart bar.

    metric_context is parsed as:
      - "status:<value>"         → status = <value> (validated)
      - "program:<value>"        → loan_program = <value>
      - "open_conditions"        → loans with at least one open condition
      - "submitted_conditions"   → loans with at least one submitted condition
      - "open_exceptions"        → loans with at least one open exception
      - "stale_files"            → loans with updated_at < now() - 72h

    The metric_context filter is ANDed onto the user-supplied filter.
    """
    extra_where, extra_params = _role_filter_clauses(current_user)
    bf = build_filter(request, tenant_id=tenant_id, extra_where=extra_where, extra_params=extra_params)

    # Exists subqueries for the "has any" KPI buckets. They are appended as
    # EXISTS clauses to the WHERE so they compose cleanly with the rest.
    exists_clauses: list[str] = []
    if request.metric_context:
        ctx = request.metric_context
        if ":" in ctx:
            field, value = ctx.split(":", 1)
            field, value = field.strip(), value.strip()
            if field == "status" and value in LoanStatus.ALL:
                bf.where_clauses.append("l.status = :metric_status")
                bf.where_params["metric_status"] = value
            elif field == "program":
                bf.where_clauses.append("l.loan_program = :metric_program")
                bf.where_params["metric_program"] = value
            elif field == "owner":
                bf.where_clauses.append("l.assigned_to = :metric_owner")
                bf.where_params["metric_owner"] = value
        else:
            if ctx == "open_conditions":
                exists_clauses.append(
                    "EXISTS (SELECT 1 FROM conditions cx "
                    "WHERE cx.loan_id = l.id AND cx.tenant_id = l.tenant_id "
                    "  AND cx.status = 'open')"
                )
            elif ctx == "submitted_conditions":
                exists_clauses.append(
                    "EXISTS (SELECT 1 FROM conditions cx "
                    "WHERE cx.loan_id = l.id AND cx.tenant_id = l.tenant_id "
                    "  AND cx.status = 'submitted')"
                )
            elif ctx == "open_exceptions":
                exists_clauses.append(
                    "EXISTS (SELECT 1 FROM exceptions ex "
                    "WHERE ex.loan_id = l.id AND ex.tenant_id = l.tenant_id "
                    "  AND ex.status IN ('open','submitted','under_review','additional_info_requested'))"
                )
            elif ctx == "stale_files":
                bf.where_clauses.append("l.updated_at < now() - interval '72 hours'")
                bf.where_clauses.append(
                    "l.status NOT IN ('funded','closed','post_closing','archived','denied','withdrawn','cancelled')"
                )

    where_sql = " AND ".join(bf.where_clauses + exists_clauses)

    # Build sort + paginate. The sort column whitelist lives in analytics_filters.
    sort_sql, sort_params = render_sort_clause(request.sort)
    bf.where_params.update(sort_params)
    offset = (request.page - 1) * request.limit

    # days_in_status: the same DISTINCT ON pattern used by aging. Inline so we
    # can join it into the SELECT without an extra round-trip.
    days_in_status_sql = """
        LEFT JOIN LATERAL (
            SELECT occurred_at
            FROM loan_status_events
            WHERE loan_id = l.id AND tenant_id = l.tenant_id
            ORDER BY occurred_at DESC
            LIMIT 1
        ) le ON true
    """

    # open_conditions per loan (single round-trip with the LATERAL).
    open_cond_sql = """
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS n
            FROM conditions
            WHERE loan_id = l.id AND tenant_id = l.tenant_id AND status = 'open'
        ) open_cond ON true
    """
    sub_cond_sql = """
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS n
            FROM conditions
            WHERE loan_id = l.id AND tenant_id = l.tenant_id AND status = 'submitted'
        ) sub_cond ON true
    """

    # Count total first so the response can return pagination metadata.
    count_sql = f"SELECT COUNT(*) AS total FROM loans l {chr(10).join(bf.joins)} WHERE {where_sql}"
    total = int(db.execute(text(count_sql), bf.where_params).scalar() or 0)

    list_sql = f"""
        SELECT
            l.id,
            l.loan_number,
            l.status,
            l.loan_program,
            l.submitted_at,
            l.updated_at,
            lf.loan_amount,
            u.full_name AS assigned_to_name,
            COALESCE(
                NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), ''),
                NULL
            ) AS borrower_name,
            COALESCE(open_cond.n, 0)::int                                  AS open_conditions,
            (COALESCE(open_cond.n, 0) + COALESCE(sub_cond.n, 0))::int        AS actions_needed,
            EXTRACT(DAY FROM (now() - le.occurred_at))::int                 AS days_in_status
        FROM loans l
        LEFT JOIN loan_financials lf ON lf.loan_id = l.id
        LEFT JOIN users u ON u.id = l.assigned_to
        LEFT JOIN LATERAL (
            SELECT first_name, last_name
            FROM borrowers
            WHERE loan_id = l.id AND type = 'primary_borrower'
            LIMIT 1
        ) b ON true
        {open_cond_sql}
        {sub_cond_sql}
        {days_in_status_sql}
        WHERE {where_sql}
        {sort_sql}
        LIMIT :limit OFFSET :offset
    """
    list_params = {**bf.where_params, "limit": request.limit, "offset": offset}
    rows = db.execute(text(list_sql), list_params).mappings().all()

    columns = request.columns or [
        "loan_number", "borrower_name", "status", "loan_program",
        "loan_amount", "submitted_at", "assigned_to_name",
        "days_in_status", "open_conditions", "actions_needed",
    ]

    drill_rows = [
        DrilldownRow(
            id=r["id"],
            loan_number=r["loan_number"],
            borrower_name=r["borrower_name"],
            status=r["status"],
            loan_program=r["loan_program"],
            loan_amount=r["loan_amount"],
            submitted_at=r["submitted_at"],
            updated_at=r["updated_at"],
            assigned_to_name=r["assigned_to_name"],
            days_in_status=r["days_in_status"],
            open_conditions=int(r["open_conditions"] or 0),
            actions_needed=int(r["actions_needed"] or 0),
        )
        for r in rows
    ]

    return DrilldownResponse(
        meta=DrilldownMeta(
            total=total,
            page=request.page,
            limit=request.limit,
            metric_context=request.metric_context,
        ),
        rows=drill_rows,
        columns=columns,
    )


# ── Public API: summary ──────────────────────────────────────────────────────

_CURRENCY_FMT = "${:,.0f}"
_CURRENCY_COMPACT_FMT = "${:,.1f}"


def _fmt_currency(value: float, compact: bool = False) -> str:
    if compact and abs(value) >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if compact and abs(value) >= 1_000:
        return f"${value / 1_000:.1f}K"
    return _CURRENCY_FMT.format(value)


def get_summary(
    db: Session,
    request: AnalyticsFilterRequest,
    *,
    tenant_id: UUID,
    current_user,
) -> SummaryResponse:
    """Compute the full summary response (KPIs + charts + meta) in one call."""
    active_loans, _ = _kpi_total_active_loans(db, request, tenant_id=tenant_id, current_user=current_user)
    pipeline_volume, volume_loan_count = _kpi_pipeline_volume(db, request, tenant_id=tenant_id, current_user=current_user)
    submitted_mtd = _kpi_submitted_this_month(db, request, tenant_id=tenant_id, current_user=current_user)
    funded_volume, funded_count = _kpi_funded_mtd(db, request, tenant_id=tenant_id, current_user=current_user)
    open_conditions = _kpi_open_conditions(db, request, tenant_id=tenant_id, current_user=current_user)
    open_exceptions = _kpi_open_exceptions(db, request, tenant_id=tenant_id, current_user=current_user)
    stale_files = _kpi_stale_files(db, request, tenant_id=tenant_id, current_user=current_user)
    sla_breaches = _kpi_sla_breaches(db, request, tenant_id=tenant_id, current_user=current_user)

    avg_loan_amount = (pipeline_volume / volume_loan_count) if volume_loan_count else 0.0

    kpis: list[KpiCard] = [
        KpiCard(
            id="total_active_loans",
            label="Total Active Loans",
            value=float(active_loans),
            formatted_value=str(active_loans),
            detail=f"{volume_loan_count} in pipeline",
            drilldown_key="active_loans",
        ),
        KpiCard(
            id="pipeline_volume",
            label="Pipeline Volume",
            value=pipeline_volume,
            formatted_value=_fmt_currency(pipeline_volume, compact=True),
            detail=_fmt_currency(pipeline_volume),
            drilldown_key="active_loans",
        ),
        KpiCard(
            id="average_loan_amount",
            label="Average Loan Amount",
            value=avg_loan_amount,
            formatted_value=_fmt_currency(avg_loan_amount, compact=True),
            detail="Active files only",
            drilldown_key="active_loans",
        ),
        KpiCard(
            id="submitted_this_month",
            label="Submitted This Month",
            value=float(submitted_mtd),
            formatted_value=str(submitted_mtd),
            detail="Loans moved to Submitted",
            drilldown_key="status:submitted",
        ),
        KpiCard(
            id="funded_mtd",
            label="Funded MTD",
            value=funded_volume,
            formatted_value=_fmt_currency(funded_volume, compact=True),
            detail=f"{funded_count} loans funded this month",
            drilldown_key="status:funded",
        ),
        KpiCard(
            id="open_conditions",
            label="Open Conditions",
            value=float(open_conditions),
            formatted_value=str(open_conditions),
            detail="Awaiting borrower or team",
            tone="warning" if open_conditions > 0 else "neutral",
            drilldown_key="open_conditions",
        ),
        KpiCard(
            id="open_exceptions",
            label="Open Exceptions",
            value=float(open_exceptions),
            formatted_value=str(open_exceptions),
            detail="In review queue",
            tone="warning" if open_exceptions > 0 else "neutral",
            drilldown_key="open_exceptions",
        ),
        KpiCard(
            id="stale_files",
            label="Stale Files (72h+)",
            value=float(stale_files),
            formatted_value=str(stale_files),
            detail="No update in 3 days",
            tone="danger" if stale_files > 0 else "neutral",
            drilldown_key="stale_files",
        ),
        KpiCard(
            id="sla_breaches",
            label="SLA Breaches",
            value=float(sla_breaches),
            formatted_value=str(sla_breaches),
            detail="> 5 days in submitted/conditions_review",
            tone="danger" if sla_breaches > 0 else "neutral",
            drilldown_key="status:conditions_review",
        ),
    ]

    charts = AnalyticsCharts(
        status_count=_chart_status_count(db, request, tenant_id=tenant_id, current_user=current_user),
        status_volume=_chart_status_volume(db, request, tenant_id=tenant_id, current_user=current_user),
        channel_mix=_chart_channel_mix(db, request, tenant_id=tenant_id, current_user=current_user),
        monthly_submissions=_chart_monthly_submissions(db, request, tenant_id=tenant_id, current_user=current_user),
        aging_by_status=_chart_aging_by_status(db, request, tenant_id=tenant_id, current_user=current_user),
        action_needed=_chart_action_needed(db, request, tenant_id=tenant_id, current_user=current_user),
    )

    return SummaryResponse(
        meta=_build_meta(db, request, tenant_id),
        kpis=kpis,
        charts=charts,
    )


# ── CSV export ───────────────────────────────────────────────────────────────

def export_drilldown_csv(
    db: Session,
    request: DrilldownRequest,
    *,
    tenant_id: UUID,
    current_user,
    row_cap: int = 5_000,
) -> tuple[str, str]:
    """
    Render the drilldown result as CSV.

    Returns (csv_text, filename). The router wraps this in a StreamingResponse.
    The row cap protects against accidental mass exports — Phase 7 may raise
    this for admin/manager roles.
    """
    # Force the limit to the cap so we never stream more than row_cap rows.
    capped = request.model_copy(update={"limit": min(request.limit, row_cap), "page": 1})
    result = drilldown_loans(db, capped, tenant_id=tenant_id, current_user=current_user)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    columns = result.columns or [
        "id", "loan_number", "borrower_name", "status", "loan_program",
        "loan_amount", "submitted_at", "updated_at", "assigned_to_name",
        "days_in_status", "open_conditions", "actions_needed",
    ]
    writer.writerow(columns)
    for r in result.rows:
        writer.writerow([getattr(r, c, None) for c in columns])

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"origina_analytics_{stamp}.csv"
    return buffer.getvalue(), filename