"""
Analytics filter validation and SQL fragment builder.

This module is the **safety boundary** between user input and the analytics
SQL surface. The frontend sends a structured filter object; this layer:

  1. Validates every `field` against ALLOWED_FILTER_FIELDS
  2. Validates every `operator` against ALLOWED_OPERATORS
  3. Coerces values to the right Python type before they reach SQLAlchemy
  4. Resolves relative date presets into concrete (from, to) tuples
  5. Builds parameterized SQL fragments — values are bound, never interpolated

If you add a new field that should be filterable from the dashboard, add it
to ALLOWED_FILTER_FIELDS. Nothing else. The whitelist is the contract.

See docs/architecture/dashboard.md Section 7 (Query Builder Design).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import HTTPException, status

from app.models.loan import LoanStatus, LoanPurpose
from app.schemas.analytics_schema import (
    AnalyticsFilterRequest,
    DatePreset,
    DateRangeFilter,
    FieldFilter,
    SortSpec,
)


# ── Loan status labels (mirrors frontend/src/types/loan.ts) ──────────────────
LOAN_STATUS_LABELS: dict[str, str] = {
    "new_draft":         "New Draft",
    "submitted":         "Submitted",
    "conditions_review": "Conditions Review",
    "approved_pending":  "Approved – Pending",
    "approved":          "Approved",
    "funded":            "Funded",
    "closed":            "Closed",
    "post_closing":      "Post Closing",
    "archived":          "Archived",
    "denied":            "Denied",
    "withdrawn":         "Withdrawn",
    "cancelled":         "Cancelled",
}


# Loan statuses that count as "active" for pipeline metrics.
ACTIVE_STATUSES: frozenset[str] = frozenset({
    "new_draft",
    "submitted",
    "conditions_review",
    "approved_pending",
    "approved",
})

# Terminal/closed statuses that fall out of active pipeline KPIs.
INACTIVE_STATUSES: frozenset[str] = frozenset({
    "funded",
    "closed",
    "post_closing",
    "archived",
    "denied",
    "withdrawn",
    "cancelled",
})


# ── Whitelists ───────────────────────────────────────────────────────────────

# SQL fragment for each operator. All values are bound via SQLAlchemy params,
# never interpolated.
ALLOWED_OPERATORS: dict[str, str] = {
    "eq":          "=",
    "neq":         "!=",
    "gt":          ">",
    "gte":         ">=",
    "lt":          "<",
    "lte":         "<=",
    "in":          "IN",
    "not_in":      "NOT IN",
    "is_null":     "IS NULL",
    "is_not_null": "IS NOT NULL",
    "like":        "LIKE",
}


@dataclass(frozen=True)
class FieldSpec:
    """Metadata for a whitelisted filter field."""
    column: str             # SQL column reference (already table-qualified, e.g. "l.status")
    type: str               # "enum" | "text" | "date" | "uuid" | "numeric" | "integer"
    values: Optional[frozenset[str]] = None
    requires_join: Optional[str] = None  # name of the table that must be joined to make this column reachable


ALLOWED_FILTER_FIELDS: dict[str, FieldSpec] = {
    # ── loans table ────────────────────────────────────────────────────────
    "status":         FieldSpec(column="l.status",          type="enum",    values=frozenset(LoanStatus.ALL)),
    "purpose":        FieldSpec(column="l.purpose",         type="enum",    values=frozenset(LoanPurpose.ALL)),
    "loan_program":   FieldSpec(column="l.loan_program",    type="text"),
    "loan_product":   FieldSpec(column="l.loan_product",    type="text"),
    "occupancy_type": FieldSpec(column="l.occupancy_type",  type="text"),
    "submitted_at":   FieldSpec(column="l.submitted_at",    type="date"),
    "funding_date":   FieldSpec(column="l.funding_date",    type="date"),
    "closing_date":   FieldSpec(column="l.closing_date",    type="date"),
    "created_at":     FieldSpec(column="l.created_at",      type="date"),
    "assigned_to":    FieldSpec(column="l.assigned_to",     type="uuid"),

    # ── loan_financials (require join) ─────────────────────────────────────
    "loan_amount":    FieldSpec(column="lf.loan_amount",    type="numeric",  requires_join="loan_financials"),
    "ltv":            FieldSpec(column="lf.ltv",            type="numeric",  requires_join="loan_financials"),
    "fico_score":     FieldSpec(column="lf.fico_score",     type="integer",  requires_join="loan_financials"),
    "dscr":           FieldSpec(column="lf.dscr",           type="numeric",  requires_join="loan_financials"),
    "dti":            FieldSpec(column="lf.debt_to_income", type="numeric",  requires_join="loan_financials"),
}


# Whitelist of sort fields (subset of filter fields — no UUIDs in sort).
ALLOWED_SORT_FIELDS: frozenset[str] = frozenset({
    "l.id", "l.created_at", "l.updated_at", "l.submitted_at", "l.funding_date",
    "l.closing_date", "lf.loan_amount", "lf.ltv", "lf.dscr", "lf.fico_score",
})


# ── Date preset resolution ───────────────────────────────────────────────────

def resolve_date_preset(
    preset: DatePreset,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> tuple[date, date]:
    """
    Convert a DatePreset into a concrete (from_date, to_date) inclusive pair.

    CUSTOM requires from_date and to_date. Any other preset computes its own
    window relative to `today()`. Returns (from, to) where from <= to.
    """
    today = date.today()
    if preset is DatePreset.CUSTOM:
        if from_date is None or to_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CUSTOM date preset requires both from_date and to_date",
            )
        if from_date > to_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="from_date must be on or before to_date",
            )
        return from_date, to_date

    if preset is DatePreset.TODAY:
        return today, today
    if preset is DatePreset.LAST_7_DAYS:
        return today - timedelta(days=6), today   # inclusive 7-day window
    if preset is DatePreset.LAST_30_DAYS:
        return today - timedelta(days=29), today
    if preset is DatePreset.THIS_MONTH:
        return today.replace(day=1), today
    if preset is DatePreset.LAST_MONTH:
        first_of_this_month = today.replace(day=1)
        last_of_prev_month = first_of_this_month - timedelta(days=1)
        first_of_prev_month = last_of_prev_month.replace(day=1)
        return first_of_prev_month, last_of_prev_month
    if preset is DatePreset.THIS_QUARTER:
        # Quarter starts on Jan/Apr/Jul/Oct 1
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=q_start_month, day=1), today
    if preset is DatePreset.YEAR_TO_DATE:
        return today.replace(month=1, day=1), today

    # Exhaustively handled above; defensive fallback.
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown date preset: {preset}",
    )


# ── Value coercion ───────────────────────────────────────────────────────────

def coerce_value(spec: FieldSpec, raw: Any) -> Any:
    """
    Coerce a raw user-supplied value into the right Python type for `spec`.

    Raises HTTPException(400) with a clear message if the value can't be
    coerced — never silently pass through.
    """
    if raw is None:
        return None

    if spec.type == "enum":
        values = spec.values or frozenset()
        if isinstance(raw, list):
            bad = [v for v in raw if v not in values]
            if bad:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid value(s) for {spec.column}: {bad}. Allowed: {sorted(values)}",
                )
            return raw
        if raw not in values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value for {spec.column}: {raw!r}. Allowed: {sorted(values)}",
            )
        return raw

    if spec.type == "text":
        # The `in` operator delivers a list; `eq` delivers a scalar string.
        if isinstance(raw, list):
            for v in raw:
                if not isinstance(v, str):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Expected string for {spec.column}, got {type(v).__name__}",
                    )
            return raw
        if not isinstance(raw, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected string for {spec.column}",
            )
        return raw

    if spec.type == "date":
        if isinstance(raw, date):
            return raw
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected ISO date for {spec.column}",
        )

    if spec.type == "uuid":
        if isinstance(raw, str):
            return raw  # SQLAlchemy binds as text, Postgres casts.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected UUID string for {spec.column}",
        )

    if spec.type == "integer":
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected integer for {spec.column}",
            )

    if spec.type == "numeric":
        try:
            return float(raw)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expected numeric value for {spec.column}",
            )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown field type {spec.type!r} for {spec.column}",
    )


# ── Filter validation ────────────────────────────────────────────────────────

def validate_filter(filter_: FieldFilter) -> tuple[FieldSpec, str, Any]:
    """
    Validate a single FieldFilter and return (spec, sql_operator, coerced_value).
    Raises HTTPException(400) with the offending field name on failure.
    """
    spec = ALLOWED_FILTER_FIELDS.get(filter_.field)
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field {filter_.field!r} is not a filterable analytics field.",
        )

    op = ALLOWED_OPERATORS.get(filter_.operator)
    if not op:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operator {filter_.operator!r} is not allowed.",
        )

    # is_null / is_not_null do not need a value; the others do.
    needs_value = filter_.operator not in {"is_null", "is_not_null"}
    if needs_value and filter_.value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operator {filter_.operator!r} on field {filter_.field!r} requires a value.",
        )

    coerced = coerce_value(spec, filter_.value) if needs_value else None

    # in / not_in must have a list
    if filter_.operator in {"in", "not_in"}:
        if not isinstance(coerced, list) or len(coerced) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Operator {filter_.operator!r} requires a non-empty list value.",
            )

    return spec, op, coerced


def validate_sort(sort: SortSpec) -> str:
    """Return the SQL fragment (column) for a sort spec, or raise 400."""
    # Accept both raw column names ("loan_amount") and table-qualified ("lf.loan_amount")
    candidate = sort.field if sort.field.startswith(("l.", "lf.")) else f"l.{sort.field}"
    if candidate not in ALLOWED_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by field {sort.field!r}.",
        )
    return candidate


# ── SQL fragment builder ─────────────────────────────────────────────────────

@dataclass
class BuiltFilter:
    """The materialized filter ready for SQL composition."""
    joins: list[str]                 # e.g. ["LEFT JOIN loan_financials lf ON lf.loan_id = l.id"]
    where_clauses: list[str]         # e.g. ["l.tenant_id = :tenant_id", "l.status IN :statuses"]
    where_params: dict[str, Any]     # bound params (already typed/coerced)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_field: Optional[str] = None

    def render(self) -> tuple[list[str], list[str], dict[str, Any]]:
        return self.joins, self.where_clauses, self.where_params


def build_filter(
    request: AnalyticsFilterRequest,
    *,
    tenant_id: Any,
    extra_where: Optional[list[str]] = None,
    extra_params: Optional[dict[str, Any]] = None,
) -> BuiltFilter:
    """
    Materialize an AnalyticsFilterRequest into joins/where/params for one query.

    The tenant_id is always the first WHERE clause. Additional tenant-bound
    restrictions (e.g. role-scoped row filters) can be appended via `extra_where`.
    """
    joins: list[str] = []
    clauses: list[str] = ["l.tenant_id = :tenant_id"]
    params: dict[str, Any] = {"tenant_id": tenant_id}

    # ── Date range ────────────────────────────────────────────────────────
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_field: Optional[str] = None
    if request.date_range:
        dr: DateRangeFilter = request.date_range
        date_field = dr.field
        date_from, date_to = resolve_date_preset(dr.preset, dr.from_date, dr.to_date)
        # Bind the resolved dates; SQL fragment is constant text (safe).
        # Qualify with the loans table alias — a date filter applied to a
        # query that LEFT JOINs `exceptions` or other tables sharing column
        # names (submitted_at) would otherwise become ambiguous.
        clauses.append(f"l.{dr.field} >= :date_from")
        clauses.append(f"l.{dr.field} <= :date_to")
        params["date_from"] = date_from
        params["date_to"] = date_to

    # ── Field filters ─────────────────────────────────────────────────────
    for idx, f in enumerate(request.filters):
        spec, op, value = validate_filter(f)
        if spec.requires_join:
            join_sql = _JOIN_SQL.get(spec.requires_join)
            if join_sql and join_sql not in joins:
                joins.append(join_sql)

        # is_null / is_not_null have no value, no param binding needed.
        if op in {"IS NULL", "IS NOT NULL"}:
            clauses.append(f"{spec.column} {op}")
            continue

        # in / not_in bind the list directly.
        if op in {"IN", "NOT IN"}:
            # Use ANY/NOT ANY syntax instead of IN (:list) so the parameter
            # is bound as a text[] and PostgreSQL picks the right operator.
            # Bare "l.status IN (:list)" raises "operator does not exist:
            # character varying = text[]" against a varchar column.
            param_key = f"f_{idx}_list"
            sql_op = "IN" if op == "IN" else "NOT IN"
            clauses.append(f"{spec.column} = ANY(:{param_key})" if op == "IN" else f"{spec.column} <> ALL(:{param_key})")
            params[param_key] = list(value)
            continue

        # Scalar comparison.
        param_key = f"f_{idx}_val"
        clauses.append(f"{spec.column} {op} (:{param_key})")
        params[param_key] = value

    # ── Extra tenant-scoped clauses (role-based row filters) ──────────────
    if extra_where:
        clauses.extend(extra_where)
    if extra_params:
        params.update(extra_params)

    return BuiltFilter(
        joins=joins,
        where_clauses=clauses,
        where_params=params,
        date_from=date_from,
        date_to=date_to,
        date_field=date_field,
    )


# Standard joins keyed by `requires_join` value. Idempotent — append() above
# dedupes via membership check.
_JOIN_SQL: dict[str, str] = {
    "loan_financials": "LEFT JOIN loan_financials lf ON lf.loan_id = l.id",
}


# ── Sort rendering ───────────────────────────────────────────────────────────

def render_sort_clause(sorts: list[SortSpec]) -> tuple[str, dict[str, Any]]:
    """
    Return ("ORDER BY col1 DESC, col2 ASC", params). Always includes a stable
    secondary sort on l.id so pagination is deterministic.
    """
    parts: list[str] = []
    for s in sorts:
        col = validate_sort(s)
        parts.append(f"{col} {s.direction.upper()}")
    if "l.id" not in [p.split()[0] for p in parts]:
        parts.append("l.id DESC")
    return "ORDER BY " + ", ".join(parts), {}


# ── Filter summary (for the freshness header) ────────────────────────────────

def summarize_filter(request: AnalyticsFilterRequest) -> str:
    """
    A short, human-readable summary of the active filter — shown in the
    analytics header ("Last 30 days · status: submitted, conditions_review").
    """
    bits: list[str] = []
    if request.date_range:
        dr = request.date_range
        if dr.preset is DatePreset.CUSTOM:
            bits.append(f"{dr.field}: {dr.from_date} → {dr.to_date}")
        else:
            bits.append(dr.preset.value.replace("_", " "))
    for f in request.filters:
        v = f.value
        if isinstance(v, list):
            v = ", ".join(str(x) for x in v)
        bits.append(f"{f.field} {f.operator} {v}")
    return " · ".join(bits) if bits else "No filters"