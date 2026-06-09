from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.loan import Loan, LoanFinancials, LoanParty, LoanTerms
from app.models.user import User
from app.models.workflow import LoanStatusEvent
from app.schemas.loan_schema import (
    LoanCreate,
    LoanFinancialsOut,
    LoanFinancialsUpdate,
    LoanOut,
    LoanPartyCreate,
    LoanPartyOut,
    LoanPipelineSummaryOut,
    LoanTermsOut,
    LoanTermsUpdate,
    LoanUpdate,
)
from app.schemas.workflow_schema import StatusEventCreate, StatusEventOut
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/loans", tags=["loans"])


def _get_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.post("/", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude={"tenant_id"})
    loan = Loan(**data, tenant_id=current_user.tenant_id)
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


@router.get("/", response_model=list[LoanOut])
def list_loans(
    status: str | None = None,
    assigned_to: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Loan).filter(Loan.tenant_id == current_user.tenant_id)
    if status:
        query = query.filter(Loan.status == status)
    if assigned_to:
        query = query.filter(Loan.assigned_to == assigned_to)
    return query.order_by(Loan.created_at.desc()).offset(skip).limit(limit).all()


_PIPELINE_SQL = text("""
    SELECT
        l.id,
        l.loan_number,
        l.status,
        l.loan_program,
        l.submitted_at,
        l.updated_at,
        lf.loan_amount,
        COALESCE(
            NULLIF(TRIM(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')), ''),
            'Unnamed Borrower'
        ) AS borrower_name,
        p.state AS property_state,
        COALESCE(open_ct.cnt, 0)  AS conditions_open,
        COALESCE(sub_ct.cnt, 0)   AS conditions_submitted,
        COALESCE(open_ct.cnt, 0) + COALESCE(sub_ct.cnt, 0) AS actions_needed
    FROM loans l
    LEFT JOIN loan_financials lf ON lf.loan_id = l.id
    LEFT JOIN LATERAL (
        SELECT first_name, last_name
        FROM borrowers
        WHERE loan_id = l.id AND type = 'primary_borrower'
        LIMIT 1
    ) b ON true
    LEFT JOIN LATERAL (
        SELECT state
        FROM properties
        WHERE loan_id = l.id AND is_subject = true
        LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM conditions
        WHERE loan_id = l.id AND tenant_id = l.tenant_id AND status = 'open'
    ) open_ct ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM conditions
        WHERE loan_id = l.id AND tenant_id = l.tenant_id AND status = 'submitted'
    ) sub_ct ON true
    WHERE l.tenant_id = :tenant_id
      AND l.status NOT IN ('archived', 'cancelled')
    ORDER BY l.updated_at DESC
    LIMIT :limit OFFSET :skip
""")


@router.get("/pipeline", response_model=list[LoanPipelineSummaryOut])
def get_pipeline(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        _PIPELINE_SQL,
        {"tenant_id": current_user.tenant_id, "limit": limit, "skip": skip},
    ).mappings().all()
    return [LoanPipelineSummaryOut(**dict(row)) for row in rows]


@router.get("/{loan_id}", response_model=LoanOut)
def get_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(loan_id, db, current_user.tenant_id)


@router.patch("/{loan_id}", response_model=LoanOut)
def update_loan(
    loan_id: UUID,
    payload: LoanUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(loan, k, v)
    db.commit()
    db.refresh(loan)
    return loan


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(
    loan_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    db.delete(loan)
    db.commit()
    return None


# ── Financials ─────────────────────────────────────────────────────────────────

@router.get("/{loan_id}/financials", response_model=LoanFinancialsOut)
def get_financials(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    if not loan.financials:
        raise HTTPException(status_code=404, detail="Financials not found — create them first with PUT")
    return loan.financials


@router.put("/{loan_id}/financials", response_model=LoanFinancialsOut)
def upsert_financials(
    loan_id: UUID,
    payload: LoanFinancialsUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    if loan.financials:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(loan.financials, k, v)
    else:
        fin = LoanFinancials(
            loan_id=loan_id,
            tenant_id=current_user.tenant_id,
            **payload.model_dump(exclude_unset=True),
        )
        db.add(fin)
    db.commit()
    db.refresh(loan)
    return loan.financials


# ── Terms ──────────────────────────────────────────────────────────────────────

@router.get("/{loan_id}/terms", response_model=LoanTermsOut)
def get_terms(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    if not loan.terms:
        raise HTTPException(status_code=404, detail="Terms not found — create them first with PUT")
    return loan.terms


@router.put("/{loan_id}/terms", response_model=LoanTermsOut)
def upsert_terms(
    loan_id: UUID,
    payload: LoanTermsUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    if loan.terms:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(loan.terms, k, v)
    else:
        terms = LoanTerms(
            loan_id=loan_id,
            tenant_id=current_user.tenant_id,
            **payload.model_dump(exclude_unset=True),
        )
        db.add(terms)
    db.commit()
    db.refresh(loan)
    return loan.terms


# ── Status Events ──────────────────────────────────────────────────────────────

@router.get("/{loan_id}/status-events", response_model=list[StatusEventOut])
def list_status_events(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(LoanStatusEvent)
        .filter(LoanStatusEvent.loan_id == loan.id)
        .order_by(LoanStatusEvent.occurred_at)
        .all()
    )


@router.post("/{loan_id}/status-events", response_model=StatusEventOut, status_code=status.HTTP_201_CREATED)
def create_status_event(
    loan_id: UUID,
    payload: StatusEventCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    event = LoanStatusEvent(
        tenant_id=current_user.tenant_id,
        loan_id=loan.id,
        from_status=loan.status,
        to_status=payload.to_status,
        reason=payload.reason,
        actor_user_id=current_user.id,
    )
    loan.status = payload.to_status
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# ── Parties ────────────────────────────────────────────────────────────────────

@router.post("/{loan_id}/parties", response_model=LoanPartyOut, status_code=status.HTTP_201_CREATED)
def add_party(
    loan_id: UUID,
    payload: LoanPartyCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    link = LoanParty(
        tenant_id=current_user.tenant_id,
        loan_id=loan.id,
        party_id=payload.party_id,
        role=payload.role,
        is_primary=payload.is_primary,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{loan_id}/parties/{party_id}/{role}", status_code=status.HTTP_204_NO_CONTENT)
def remove_party(
    loan_id: UUID,
    party_id: UUID,
    role: str,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _get_or_404(loan_id, db, current_user.tenant_id)
    link = db.query(LoanParty).filter(
        LoanParty.loan_id == loan_id,
        LoanParty.party_id == party_id,
        LoanParty.role == role,
        LoanParty.tenant_id == current_user.tenant_id,
    ).first()
    if link:
        db.delete(link)
        db.commit()
    return None
