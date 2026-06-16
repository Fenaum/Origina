from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.credit import CreditEvent, CreditLiability, CreditReport
from app.models.loan import Loan
from app.models.user import User
from app.schemas.credit_schema import (
    CreditEventCreate,
    CreditEventOut,
    CreditEventUpdate,
    CreditLiabilityCreate,
    CreditLiabilityOut,
    CreditLiabilityUpdate,
    CreditReportCreate,
    CreditReportOut,
    CreditReportUpdate,
)
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/credit", tags=["credit"])


def _loan_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


# ── Credit Reports ─────────────────────────────────────────────────────────────

@router.post("/reports", response_model=CreditReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: CreditReportCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    report = CreditReport(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports", response_model=list[CreditReportOut])
def list_reports(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(CreditReport)
        .filter(
            CreditReport.loan_id == loan_id,
            CreditReport.tenant_id == current_user.tenant_id,
            CreditReport.archived_at.is_(None),
        )
        .order_by(CreditReport.report_date.desc().nullslast(), CreditReport.created_at.desc())
        .all()
    )


@router.patch("/reports/{report_id}", response_model=CreditReportOut)
def update_report(
    report_id: UUID,
    payload: CreditReportUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    report = db.get(CreditReport, report_id)
    if not report or report.tenant_id != current_user.tenant_id or report.archived_at:
        raise HTTPException(status_code=404, detail="Credit report not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(report, k, v)
    db.commit()
    db.refresh(report)
    return report


# ── Credit Liabilities ─────────────────────────────────────────────────────────

@router.post("/liabilities", response_model=CreditLiabilityOut, status_code=status.HTTP_201_CREATED)
def create_liability(
    payload: CreditLiabilityCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    obj = CreditLiability(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/liabilities", response_model=list[CreditLiabilityOut])
def list_liabilities(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(CreditLiability)
        .filter(
            CreditLiability.loan_id == loan_id,
            CreditLiability.tenant_id == current_user.tenant_id,
            CreditLiability.archived_at.is_(None),
        )
        .order_by(CreditLiability.balance.desc().nullslast())
        .all()
    )


@router.patch("/liabilities/{liability_id}", response_model=CreditLiabilityOut)
def update_liability(
    liability_id: UUID,
    payload: CreditLiabilityUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.get(CreditLiability, liability_id)
    if not obj or obj.tenant_id != current_user.tenant_id or obj.archived_at:
        raise HTTPException(status_code=404, detail="Liability not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/liabilities/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(
    liability_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    obj = db.get(CreditLiability, liability_id)
    if not obj or obj.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Liability not found")
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()


# ── Credit Events ──────────────────────────────────────────────────────────────

@router.post("/events", response_model=CreditEventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: CreditEventCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(payload.loan_id, db, current_user.tenant_id)
    obj = CreditEvent(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/events", response_model=list[CreditEventOut])
def list_events(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _loan_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(CreditEvent)
        .filter(
            CreditEvent.loan_id == loan_id,
            CreditEvent.tenant_id == current_user.tenant_id,
        )
        .order_by(CreditEvent.event_date.desc().nullslast())
        .all()
    )


@router.patch("/events/{event_id}", response_model=CreditEventOut)
def update_event(
    event_id: UUID,
    payload: CreditEventUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.get(CreditEvent, event_id)
    if not obj or obj.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Credit event not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj
