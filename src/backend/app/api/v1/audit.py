from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.audit import AuditLog, Snapshot
from app.models.user import User
from app.schemas.audit_schema import AuditLogOut, SnapshotOut
from app.security.security import get_current_user

router = APIRouter(tags=["audit"])


@router.get("/audit-logs/", response_model=list[AuditLogOut])
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
    return query.order_by(AuditLog.occurred_at.desc()).offset(skip).limit(limit).all()


@router.get("/snapshots/", response_model=list[SnapshotOut])
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
    return query.order_by(Snapshot.created_at.desc()).offset(skip).limit(limit).all()


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
