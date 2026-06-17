from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.loan import Loan
from app.models.title import TitleException, TitleOrder
from app.models.user import User
from app.schemas.title_schema import (
    TitleExceptionCreate,
    TitleExceptionOut,
    TitleExceptionUpdate,
    TitleOrderCreate,
    TitleOrderOut,
    TitleOrderUpdate,
)
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/title", tags=["title"])


def _loan_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


# ── Title Orders ───────────────────────────────────────────────────────────────

@router.post("/orders", response_model=TitleOrderOut, status_code=status.HTTP_201_CREATED)
def create_title_order(
    payload: TitleOrderCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    order = TitleOrder(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=list[TitleOrderOut])
def list_title_orders(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(TitleOrder)
        .filter(
            TitleOrder.loan_id == loan_id,
            TitleOrder.tenant_id == current_user.tenant_id,
            TitleOrder.archived_at.is_(None),
        )
        .order_by(TitleOrder.created_at.desc())
        .all()
    )


@router.get("/orders/{order_id}", response_model=TitleOrderOut)
def get_title_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.get(TitleOrder, order_id)
    if not order or order.tenant_id != current_user.tenant_id or order.archived_at:
        raise HTTPException(status_code=404, detail="Title order not found")
    return order


@router.patch("/orders/{order_id}", response_model=TitleOrderOut)
def update_title_order(
    order_id: UUID,
    payload: TitleOrderUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    order = db.get(TitleOrder, order_id)
    if not order or order.tenant_id != current_user.tenant_id or order.archived_at:
        raise HTTPException(status_code=404, detail="Title order not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    db.commit()
    db.refresh(order)
    return order


# ── Title Exceptions ───────────────────────────────────────────────────────────

@router.post("/exceptions", response_model=TitleExceptionOut, status_code=status.HTTP_201_CREATED)
def create_title_exception(
    payload: TitleExceptionCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    obj = TitleException(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/exceptions", response_model=list[TitleExceptionOut])
def list_title_exceptions(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(TitleException)
        .filter(
            TitleException.loan_id == loan_id,
            TitleException.tenant_id == current_user.tenant_id,
        )
        .order_by(TitleException.created_at.desc())
        .all()
    )


@router.patch("/exceptions/{exception_id}", response_model=TitleExceptionOut)
def update_title_exception(
    exception_id: UUID,
    payload: TitleExceptionUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.get(TitleException, exception_id)
    if not obj or obj.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Title exception not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj
