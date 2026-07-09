from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.conditions import Condition, ConditionStatus
from app.models.user import User
from app.schemas.common_schema import PaginatedResponse
from app.schemas.condition_schema import ConditionCreate, ConditionOut, ConditionUpdate, WaiveRequest
from app.security.roles import ACCOUNT_MANAGER, UNDERWRITER, require_roles
from app.security.security import get_audited_db, get_current_user
from app.services.condition_lifecycle import assert_transition_allowed

router = APIRouter(prefix="/conditions", tags=["conditions"])


class RejectRequest(BaseModel):
    """Optional human-readable rejection reason. Stored on waive_reason for
    now — a dedicated rejected_reason column lands in Sprint 5 hardening."""

    reason: str | None = None


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
    # Newly created conditions always start at "open" — server-side guard.
    condition.status = ConditionStatus.OPEN
    db.add(condition)
    db.commit()
    db.refresh(condition)
    return condition


@router.get("/", response_model=PaginatedResponse[ConditionOut])
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
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return PaginatedResponse[ConditionOut](items=items, total=total)


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
    """Edit name/description/stage/condition_number. Status transitions go
    through the dedicated lifecycle endpoints (/submit, /clear, /waive,
    /reject) so the state machine is enforced."""
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    # If a client tries to PATCH status, refuse — lifecycle endpoints own it.
    updates.pop("status", None)
    for k, v in updates.items():
        setattr(condition, k, v)
    db.commit()
    db.refresh(condition)
    return condition


# ── Lifecycle endpoints ───────────────────────────────────────────────────────
# These endpoints mutate condition.status only via the state-machine service.
# Direct PATCH of status is rejected above; these are the only legal path.

@router.post("/{condition_id}/submit", response_model=ConditionOut)
def submit_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """open → submitted. Borrower (or processor) acknowledges they've sent
    documentation; UW can now clear / waive / reject."""
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, ConditionStatus.SUBMITTED)
    condition.status = ConditionStatus.SUBMITTED
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{condition_id}/clear", response_model=ConditionOut)
def clear_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """submitted → cleared. UW confirms documentation is acceptable."""
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, ConditionStatus.CLEARED)
    condition.status = ConditionStatus.CLEARED
    condition.cleared_by = current_user.id
    condition.cleared_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{condition_id}/waive", response_model=ConditionOut)
def waive_condition(
    condition_id: UUID,
    payload: WaiveRequest = WaiveRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """open | submitted → waived. UW drops the requirement without
    documentation (a legal exception, must appear in compliance reports)."""
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, ConditionStatus.WAIVED)
    condition.status = ConditionStatus.WAIVED
    condition.waived_by = current_user.id
    condition.waived_at = datetime.now(timezone.utc)
    condition.waive_reason = payload.reason
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{condition_id}/reject", response_model=ConditionOut)
def reject_condition(
    condition_id: UUID,
    payload: RejectRequest = RejectRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(UNDERWRITER, ACCOUNT_MANAGER)),
):
    """submitted → rejected. UW / AM bounce documentation back to the
    processor — the condition flips back to needing action."""
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, ConditionStatus.REJECTED)
    condition.status = ConditionStatus.REJECTED
    # Reuse waive_reason column for now — see schemas.note on RejectRequest.
    condition.waive_reason = payload.reason
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
