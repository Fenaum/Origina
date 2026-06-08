from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.conditions import Condition
from app.models.user import User
from app.schemas.condition_schema import ConditionCreate, ConditionOut, ConditionUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/conditions", tags=["conditions"])


def _get_or_404(condition_id: UUID, db: Session, tenant_id: UUID) -> Condition:
    condition = db.get(Condition, condition_id)
    if not condition or condition.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Condition not found")
    return condition


@router.post("/", response_model=ConditionOut, status_code=status.HTTP_201_CREATED)
def create_condition(
    payload: ConditionCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = Condition(
        tenant_id=current_user.tenant_id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(condition)
    db.commit()
    db.refresh(condition)
    return condition


@router.get("/", response_model=list[ConditionOut])
def list_conditions(
    loan_id: UUID | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Condition).filter(Condition.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Condition.loan_id == loan_id)
    if status_filter:
        query = query.filter(Condition.status == status_filter)
    return query.offset(skip).limit(limit).all()


@router.get("/{condition_id}", response_model=ConditionOut)
def get_condition(
    condition_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(condition_id, db, current_user.tenant_id)


@router.patch("/{condition_id}", response_model=ConditionOut)
def update_condition(
    condition_id: UUID,
    payload: ConditionUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(condition, k, v)
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{condition_id}/clear", response_model=ConditionOut)
def clear_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    condition.status = "cleared"
    condition.cleared_by = current_user.id
    condition.cleared_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{condition_id}/waive", response_model=ConditionOut)
def waive_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    condition.status = "waived"
    condition.waived_by = current_user.id
    condition.waived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(condition)
    return condition


@router.delete("/{condition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    db.delete(condition)
    db.commit()
    return None
