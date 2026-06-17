from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.escrow import EscrowDetail
from app.models.loan import Loan
from app.models.user import User
from app.schemas.escrow_schema import EscrowDetailCreate, EscrowDetailOut, EscrowDetailUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/escrow", tags=["escrow"])


def _loan_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.get("/{loan_id}", response_model=EscrowDetailOut | None)
def get_escrow(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(EscrowDetail)
        .filter(
            EscrowDetail.loan_id == loan_id,
            EscrowDetail.tenant_id == current_user.tenant_id,
            EscrowDetail.archived_at.is_(None),
        )
        .first()
    )


@router.put("/{loan_id}", response_model=EscrowDetailOut)
def upsert_escrow(
    loan_id: UUID,
    payload: EscrowDetailCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    existing = (
        db.query(EscrowDetail)
        .filter(
            EscrowDetail.loan_id == loan_id,
            EscrowDetail.tenant_id == current_user.tenant_id,
            EscrowDetail.archived_at.is_(None),
        )
        .first()
    )
    if existing:
        for k, v in payload.model_dump(exclude_unset=True, exclude={"loan_id"}).items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        obj = EscrowDetail(tenant_id=current_user.tenant_id, **payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
