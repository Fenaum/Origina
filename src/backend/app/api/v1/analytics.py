"""
Analytics dashboard API.

Endpoints:
  GET  /api/v1/analytics/summary         → SummaryResponse
  POST /api/v1/analytics/drilldown       → DrilldownResponse
  POST /api/v1/analytics/export          → CSV stream
  GET  /api/v1/analytics/saved-views     → list of SavedViewOut (own + shared)
  POST /api/v1/analytics/saved-views     → create
  PATCH /api/v1/analytics/saved-views/{id} → update (owner only)
  DELETE /api/v1/analytics/saved-views/{id} → 204 (owner only)

The router delegates ALL query logic to `app.services.analytics_repo` and ALL
filter validation to `app.core.analytics_filters`. This file is intentionally
thin — request parsing, role enforcement, and response shaping only.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.analytics_filters import build_filter
from app.models.analytics import SavedAnalyticsView
from app.models.user import User
from app.schemas.analytics_schema import (
    AnalyticsFilterRequest,
    DatePreset,
    DateRangeFilter,
    DrilldownRequest,
    FieldFilter,
    SavedViewCreate,
    SavedViewOut,
    SavedViewUpdate,
    SortSpec,
)
from app.security.security import get_current_user
from app.services import analytics_repo

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _to_filter_request(
    *,
    date_field: Optional[str],
    date_preset: Optional[DatePreset],
    date_from: Optional[str],
    date_to: Optional[str],
    statuses: list[str],
    loan_programs: list[str],
    purposes: list[str],
    assigned_to: Optional[str],
    sort_field: Optional[str],
    sort_dir: str,
    page: int,
    limit: int,
) -> AnalyticsFilterRequest:
    """
    Convert the flat query-parameter shape used by GET /summary into the
    canonical AnalyticsFilterRequest. POST /drilldown bypasses this and
    accepts the JSON body directly.

    No raw SQL is constructed from these values — every value here flows
    through the whitelists in app.core.analytics_filters.build_filter().
    """
    date_range: Optional[DateRangeFilter] = None
    if date_preset is not None or date_field is not None:
        date_range = DateRangeFilter(
            field=date_field or "submitted_at",
            preset=date_preset or DatePreset.LAST_30_DAYS,
            from_date=date_from,
            to_date=date_to,
        )

    filters: list[FieldFilter] = []
    if statuses:
        filters.append(FieldFilter(field="status", operator="in", value=statuses))
    if loan_programs:
        filters.append(FieldFilter(field="loan_program", operator="in", value=loan_programs))
    if purposes:
        filters.append(FieldFilter(field="purpose", operator="in", value=purposes))
    if assigned_to:
        filters.append(FieldFilter(field="assigned_to", operator="eq", value=assigned_to))

    sort: list[SortSpec] = []
    if sort_field:
        sort.append(SortSpec(field=sort_field, direction="desc" if sort_dir == "desc" else "asc"))
    if not sort:
        sort = [SortSpec(field="updated_at", direction="desc")]

    return AnalyticsFilterRequest(
        date_range=date_range,
        filters=filters,
        sort=sort,
        page=page,
        limit=limit,
    )


# ── Summary ──────────────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),

    # Date range
    date_field: Optional[str] = Query(default=None, description="submitted_at | funding_date | closing_date | created_at"),
    date_preset: Optional[DatePreset] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to:   Optional[str] = Query(default=None),

    # Field filters
    status: list[str]        = Query(default_factory=list),
    loan_program: list[str]  = Query(default_factory=list),
    purpose: list[str]       = Query(default_factory=list),
    assigned_to: Optional[str] = Query(default=None),

    # Sort + paginate
    sort_field: Optional[str] = Query(default="updated_at"),
    sort_dir:   str           = Query(default="desc", pattern="^(asc|desc)$"),
    page: int                 = Query(default=1, ge=1),
    limit: int                = Query(default=25, ge=1, le=200),
):
    """
    One-shot dashboard load: KPIs, charts, meta. Filters are passed as query
    parameters — for the full filter object use POST /analytics/drilldown.
    """
    request = _to_filter_request(
        date_field=date_field,
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        statuses=status,
        loan_programs=loan_program,
        purposes=purpose,
        assigned_to=assigned_to,
        sort_field=sort_field,
        sort_dir=sort_dir,
        page=page,
        limit=limit,
    )
    return analytics_repo.get_summary(
        db, request, tenant_id=current_user.tenant_id, current_user=current_user,
    )


# ── Drilldown ────────────────────────────────────────────────────────────────

@router.post("/drilldown")
def post_drilldown(
    payload: DrilldownRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated list of loans that produced a KPI or chart bar."""
    return analytics_repo.drilldown_loans(
        db, payload, tenant_id=current_user.tenant_id, current_user=current_user,
    )


# ── Export ───────────────────────────────────────────────────────────────────

@router.post("/export")
def post_export(
    payload: DrilldownRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the current drilldown as CSV. Capped at 5,000 rows."""
    csv_text, filename = analytics_repo.export_drilldown_csv(
        db, payload, tenant_id=current_user.tenant_id, current_user=current_user,
    )
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Saved views ──────────────────────────────────────────────────────────────

@router.get("/saved-views", response_model=list[SavedViewOut])
def list_saved_views(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return own views + views shared within the tenant."""
    rows = db.execute(
        select(SavedAnalyticsView)
        .where(SavedAnalyticsView.tenant_id == current_user.tenant_id)
        .where(
            (SavedAnalyticsView.created_by == current_user.id)
            | (SavedAnalyticsView.is_shared.is_(True))
        )
        .order_by(SavedAnalyticsView.is_shared.desc(), SavedAnalyticsView.updated_at.desc())
    ).scalars().all()
    return rows


@router.post("/saved-views", response_model=SavedViewOut, status_code=status.HTTP_201_CREATED)
def create_saved_view(
    payload: SavedViewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist a named filter preset. Validates the embedded filter_state against the whitelist."""
    # Re-validate by materializing the filter — this surfaces invalid fields before save.
    _ = build_filter(
        payload.filter_state,
        tenant_id=current_user.tenant_id,
        extra_where=["l.tenant_id = :tenant_id"],
    )

    view = SavedAnalyticsView(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=payload.name,
        description=payload.description,
        filter_state=payload.filter_state.model_dump(mode="json"),
        role_preset=payload.role_preset,
        is_shared=payload.is_shared,
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return view


@router.patch("/saved-views/{view_id}", response_model=SavedViewOut)
def update_saved_view(
    view_id: UUID,
    payload: SavedViewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a saved view. Only the creator may mutate a view."""
    view = db.get(SavedAnalyticsView, view_id)
    if not view or view.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Saved view not found")
    if view.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can modify a saved view")

    data = payload.model_dump(exclude_unset=True)
    if "filter_state" in data and data["filter_state"] is not None:
        # Stored shape is an AnalyticsFilterRequest — revalidate before saving.
        _ = build_filter(
            data["filter_state"],
            tenant_id=current_user.tenant_id,
            extra_where=["l.tenant_id = :tenant_id"],
        )
        data["filter_state"] = data["filter_state"].model_dump(mode="json") \
            if hasattr(data["filter_state"], "model_dump") else data["filter_state"]

    for k, v in data.items():
        setattr(view, k, v)
    db.commit()
    db.refresh(view)
    return view


@router.delete("/saved-views/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_view(
    view_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved view. Only the creator may delete."""
    view = db.get(SavedAnalyticsView, view_id)
    if not view or view.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Saved view not found")
    if view.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete a saved view")
    db.delete(view)
    db.commit()
    return None