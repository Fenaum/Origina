"""Admin settings routes: organization, audit log."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.security.security import get_audited_db
from app.models.audit import AuditLog
from app.models.user import Tenant, User
from app.schemas.user_settings_schema import TenantSettingsOut, TenantSettingsUpdate
from app.security.roles import ACCOUNT_MANAGER, IT_ADMIN, require_roles
from app.security.security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin-settings"])


# ── Organization ────────────────────────────────────────────────────────────────

@router.get("/organization", response_model=TenantSettingsOut)
def get_organization(
    current_user: User = Depends(require_roles(IT_ADMIN, ACCOUNT_MANAGER)),
):
    """Return the current tenant's organization settings."""
    return TenantSettingsOut.model_validate(current_user.tenant)


@router.patch("/organization", response_model=TenantSettingsOut)
def update_organization(
    payload: TenantSettingsUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    """Update the current tenant's organization settings. Requires it_admin role."""
    tenant: Tenant = current_user.tenant
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return TenantSettingsOut.model_validate(tenant)


# ── Audit log ──────────────────────────────────────────────────────────────────

@router.get("/audit-log")
def list_audit_log(
    table_name: Optional[str] = Query(None, description="Filter by table name"),
    actor_id: Optional[UUID] = Query(None, description="Filter by actor user ID"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity UUID"),
    days: int = Query(7, ge=1, le=365, description="Lookback window in days"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(IT_ADMIN, ACCOUNT_MANAGER)),
):
    """Read-only audit log scoped to the current tenant."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        db.query(AuditLog)
        .filter(
            AuditLog.tenant_id == current_user.tenant_id,
            AuditLog.occurred_at >= cutoff,
        )
    )

    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if actor_id:
        query = query.filter(AuditLog.actor_user_id == actor_id)
    if entity_id:
        query = query.filter(
            func.jsonb_extract_path_text(AuditLog.changes, "after").contains(str(entity_id))
        )

    total = query.count()
    rows = query.order_by(AuditLog.occurred_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": str(r.id),
                "tenant_id": str(r.tenant_id),
                "table_name": r.table_name,
                "record_id": r.record_id,
                "action": r.action,
                "actor_user_id": str(r.actor_user_id) if r.actor_user_id else None,
                "actor_name": r.actor.full_name if r.actor else None,
                "changes": r.changes,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }
