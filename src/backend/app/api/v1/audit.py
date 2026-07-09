from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.audit import AuditLog, Snapshot
from app.models.user import User
from app.schemas.audit_schema import AuditLogOut, SnapshotOut
from app.schemas.common_schema import PaginatedResponse
from app.security.security import get_current_user


router = APIRouter(tags=["audit"])


@router.get("/audit-logs/", response_model=PaginatedResponse[AuditLogOut])
def list_audit_logs(
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AuditLog).filter(AuditLog.tenant_id == current_user.tenant_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    total = query.count()
    items = query.order_by(AuditLog.occurred_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse[AuditLogOut](items=items, total=total)


@router.get("/snapshots/", response_model=PaginatedResponse[SnapshotOut])
def list_snapshots(
    loan_id: UUID | None = None,
    snapshot_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Snapshot).filter(Snapshot.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Snapshot.loan_id == loan_id)
    if snapshot_type:
        query = query.filter(Snapshot.snapshot_type == snapshot_type)
    total = query.count()
    items = query.order_by(Snapshot.created_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse[SnapshotOut](items=items, total=total)



@router.get("/snapshots/{snapshot_id}", response_model=SnapshotOut)
def get_snapshot(
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    snap = db.get(Snapshot, snapshot_id)
    if not snap or snap.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snap


# ── Field-level history ────────────────────────────────────────────────────────

class FieldHistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    audit_log_id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    field_key: str
    old_value: Optional[Any]
    new_value: Optional[Any]
    changed_by: Optional[UUID]
    changed_at: datetime


@router.get("/loans/{loan_id}/fields/{field_key}/history", response_model=list[FieldHistoryEntry])
def get_field_history(
    loan_id: UUID,
    field_key: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the audit history for a specific field on any entity associated with a loan.
    Searches audit_log entries where entity_id == loan_id OR related entity_id,
    filtered to entries where diff contains field_key.

    TODO: Extend to search borrower, financials, and terms entity IDs for deeper history.
    Currently only queries audit entries with entity_id == loan_id.
    """
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.tenant_id == current_user.tenant_id,
            AuditLog.entity_id == loan_id,
        )
        .order_by(AuditLog.occurred_at.desc())
        .limit(200)
        .all()
    )

    results: list[FieldHistoryEntry] = []
    for log in logs:
        diff = log.diff or {}
        if field_key in diff:
            change = diff[field_key]
            results.append(
                FieldHistoryEntry(
                    audit_log_id=log.id,
                    entity_type=log.entity_type,
                    entity_id=log.entity_id,
                    action=log.action,
                    field_key=field_key,
                    old_value=change.get("old") if isinstance(change, dict) else None,
                    new_value=change.get("new") if isinstance(change, dict) else change,
                    changed_by=log.actor_user_id,
                    changed_at=log.occurred_at,
                )
            )
        if len(results) >= limit:
            break
    return results
