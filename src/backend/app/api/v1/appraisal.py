from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.appraisal import AppraisalOrder
from app.models.loan import Loan
from app.models.user import User
from app.schemas.appraisal_schema import AppraisalOrderCreate, AppraisalOrderOut, AppraisalOrderUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/appraisals", tags=["appraisal"])


def _loan_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


def _order_or_404(order_id: UUID, db: Session, tenant_id: UUID) -> AppraisalOrder:
    obj = db.get(AppraisalOrder, order_id)
    if not obj or obj.tenant_id != tenant_id or obj.archived_at:
        raise HTTPException(status_code=404, detail="Appraisal order not found")
    return obj


@router.post("/", response_model=AppraisalOrderOut, status_code=status.HTTP_201_CREATED)
def create_appraisal_order(
    payload: AppraisalOrderCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    order = AppraisalOrder(
        tenant_id=current_user.tenant_id,
        ordered_by=current_user.id,
        **payload.model_dump(exclude={"loan_id"} if False else set()),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/", response_model=list[AppraisalOrderOut])
def list_appraisal_orders(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(AppraisalOrder)
        .filter(
            AppraisalOrder.loan_id == loan_id,
            AppraisalOrder.tenant_id == current_user.tenant_id,
            AppraisalOrder.archived_at.is_(None),
        )
        .order_by(AppraisalOrder.created_at.desc())
        .all()
    )


@router.get("/{order_id}", response_model=AppraisalOrderOut)
def get_appraisal_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _order_or_404(order_id, db, current_user.tenant_id)


@router.patch("/{order_id}", response_model=AppraisalOrderOut)
def update_appraisal_order(
    order_id: UUID,
    payload: AppraisalOrderUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    order = _order_or_404(order_id, db, current_user.tenant_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_appraisal_order(
    order_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    order = _order_or_404(order_id, db, current_user.tenant_id)
    order.archived_at = datetime.now(timezone.utc)
    db.commit()
