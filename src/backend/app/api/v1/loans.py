from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.borrowers import Borrower
from app.models.loan import Loan, LoanFinancials, LoanParty, LoanTerms
from app.models.user import Tenant, User
from app.models.workflow import LoanStatusEvent
from app.models.conditions import Condition
from app.models.document import Document
from app.models.workflow import Note
from app.schemas.loan_schema import (
    ActivityEventOut,
    ArchiveLoanRequest,
    LoanCreate,
    LoanFinancialsOut,
    LoanFinancialsUpdate,
    LoanNoteCreate,
    LoanOut,
    LoanPartyCreate,
    LoanPartyOut,
    LoanPipelineSummaryOut,
    LoanQuickInfoOut,
    LoanSubmitOut,
    LoanTermsOut,
    LoanTermsUpdate,
    LoanUpdate,
    MoveTenantRequest,
    PaginatedResponse,
    SandboxOut,
)
from app.schemas.workflow_schema import StatusEventCreate, StatusEventOut
from app.security.roles import ACCOUNT_MANAGER, IT_ADMIN, require_roles
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
    db.flush()  # assigns loan.id before we reference it in the event row

    # Record the initial status event so loan history starts at creation.
    # from_status is NULL — there was no prior state.
    event = LoanStatusEvent(
        tenant_id=current_user.tenant_id,
        loan_id=loan.id,
        from_status=None,
        to_status="new_draft",
        reason="Loan draft created",
        actor_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(loan)
    return loan


@router.get("/", response_model=PaginatedResponse[LoanOut])
def list_loans(
    status: str | None = None,
    assigned_to: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Loan).filter(Loan.tenant_id == current_user.tenant_id)
    if status:
        query = query.filter(Loan.status == status)
    if assigned_to:
        query = query.filter(Loan.assigned_to == assigned_to)
    total = query.count()
    items = query.order_by(Loan.created_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse(items=items, total=total)


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


_PIPELINE_COUNT_SQL = text("""
    SELECT COUNT(*) AS total
    FROM loans l
    WHERE l.tenant_id = :tenant_id
      AND l.status NOT IN ('archived', 'cancelled')
""")


@router.get("/pipeline", response_model=PaginatedResponse[LoanPipelineSummaryOut])
def get_pipeline(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        _PIPELINE_SQL,
        {"tenant_id": current_user.tenant_id, "limit": limit, "skip": skip},
    ).mappings().all()
    total = db.execute(
        _PIPELINE_COUNT_SQL,
        {"tenant_id": current_user.tenant_id},
    ).scalar_one()
    return PaginatedResponse(
        items=[LoanPipelineSummaryOut(**dict(row)) for row in rows],
        total=total,
    )


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


# ── Context Menu / Quick Actions ──────────────────────────────────────────────

@router.get("/{loan_id}/quick-info", response_model=LoanQuickInfoOut)
def get_loan_quick_info(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compact loan + financials summary for the pipeline quick-info popover."""
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    fin = db.query(LoanFinancials).filter(LoanFinancials.loan_id == loan_id).first()
    primary = (
        db.query(Borrower)
        .filter(
            Borrower.loan_id == loan_id,
            Borrower.tenant_id == current_user.tenant_id,
            Borrower.type == "primary_borrower",
        )
        .first()
    )
    borrower_name = (
        " ".join(p for p in [primary.first_name, primary.last_name] if p)
        if primary
        else "(Unknown)"
    )
    return LoanQuickInfoOut(
        id=loan.id,
        loan_number=loan.loan_number,
        status=loan.status,
        loan_program=loan.loan_program,
        purpose=loan.purpose,
        loan_amount=fin.loan_amount if fin else None,
        borrower_name=borrower_name,
        property_state=None,  # TODO: join with properties table
        submitted_at=loan.submitted_at,
        updated_at=loan.updated_at,
        ltv=fin.ltv if fin else None,
        cltv=fin.cltv if fin else None,
        fico_score=fin.fico_score if fin else None,
        debt_to_income=fin.debt_to_income if fin else None,
        dscr=fin.dscr if fin else None,
    )


@router.post("/{loan_id}/submit", response_model=LoanSubmitOut)
def submit_loan(
    loan_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Transition a loan draft from new_draft → submitted.

    Phase 1 validation (intentionally minimal — full checklist validation is Phase 2):
      - Loan must belong to the authenticated tenant.
      - Loan must be in new_draft status (prevents double-submission).

    Phase 2 TODO:
      - Require loan_financials.loan_amount > 0.
      - Validate required borrower fields (first_name, last_name, dob, ssn_last4).
      - Validate required property fields (address, state, zip).
      - Check document checklist: all required docs must be uploaded.
    """
    from datetime import date as _date

    loan = _get_or_404(loan_id, db, current_user.tenant_id)

    if loan.status != "new_draft":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Loan cannot be submitted from status '{loan.status}'. "
                   "Only new_draft loans can be submitted.",
        )

    # Assign a loan number if not already set (simple sequential format for Phase 1).
    # Phase 2 TODO: use a DB sequence or tenant-scoped numbering scheme.
    if not loan.loan_number:
        from sqlalchemy import func as _func
        count = db.query(_func.count(Loan.id)).filter(
            Loan.tenant_id == current_user.tenant_id
        ).scalar() or 0
        loan.loan_number = f"OR-{1000 + count}"

    loan.status = "submitted"
    loan.submitted_at = _date.today()

    event = LoanStatusEvent(
        tenant_id=current_user.tenant_id,
        loan_id=loan.id,
        from_status="new_draft",
        to_status="submitted",
        reason="Loan submitted by originator",
        actor_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(loan)

    # JOIN borrowers and financials to populate response fields that don't
    # live on the loans row itself.
    primary = (
        db.query(Borrower)
        .filter(
            Borrower.loan_id == loan.id,
            Borrower.tenant_id == current_user.tenant_id,
            Borrower.type == "primary_borrower",
        )
        .first()
    )
    fin = db.query(LoanFinancials).filter(LoanFinancials.loan_id == loan.id).first()

    borrower_name: str | None = None
    if primary:
        parts = [p for p in [primary.first_name, primary.last_name] if p]
        borrower_name = " ".join(parts) if parts else None

    return LoanSubmitOut(
        id=loan.id,
        loan_number=loan.loan_number,
        status=loan.status,
        submitted_at=loan.submitted_at,
        updated_at=loan.updated_at,
        borrower_name=borrower_name,
        loan_amount=fin.loan_amount if fin else None,
        loan_program=loan.loan_program,
    )


@router.post("/{loan_id}/sandbox", response_model=SandboxOut)
def open_in_sandbox(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    TODO: Implement real sandbox environment provisioning.
    Currently returns a mock response. A real implementation would
    clone the loan into an isolated sandbox tenant and return a URL.
    """
    _get_or_404(loan_id, db, current_user.tenant_id)
    return SandboxOut(
        sandbox_id=f"sbx_{loan_id}",
        url=f"/sandbox/loans/{loan_id}",
        message="Sandbox environment is not yet provisioned. Mock response only.",
    )


@router.patch("/{loan_id}/archive", response_model=LoanOut)
def archive_loan(
    loan_id: UUID,
    payload: ArchiveLoanRequest,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_roles(IT_ADMIN, ACCOUNT_MANAGER)),
):
    """
    Soft-deletes a loan by setting status = 'archived'.
    Requires IT_ADMIN or ACCOUNT_MANAGER role.
    The loan remains in the database for audit purposes.
    """
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    if loan.status in ("funded", "closed", "post_closing"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot archive a loan with status '{loan.status}'.",
        )
    loan.status = "archived"
    db.commit()
    db.refresh(loan)
    return loan


@router.patch("/{loan_id}/tenant", response_model=LoanOut)
def move_loan_tenant(
    loan_id: UUID,
    payload: MoveTenantRequest,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_roles(IT_ADMIN)),
):
    """
    Moves a loan to a different tenant. IT_ADMIN only.
    Use with extreme caution — this changes data visibility and ownership.
    A reason is strongly recommended for the audit trail.
    """
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    target = db.query(Tenant).filter(Tenant.id == payload.target_tenant_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target tenant not found")
    if target.id == loan.tenant_id:
        raise HTTPException(status_code=400, detail="Loan is already in the specified tenant")
    loan.tenant_id = payload.target_tenant_id
    db.commit()
    db.refresh(loan)
    return loan


# ── Activity feed ──────────────────────────────────────────────────────────────

_STATUS_LABELS: dict[str, str] = {
    "new_draft": "New Draft",
    "submitted": "Submitted",
    "conditions_review": "Conditions Review",
    "approved_pending": "Approved — Pending",
    "approved": "Approved",
    "funded": "Funded",
    "closed": "Closed",
    "post_closing": "Post-Closing",
    "archived": "Archived",
    "denied": "Denied",
    "withdrawn": "Withdrawn",
    "cancelled": "Cancelled",
}


@router.get("/{loan_id}/activity", response_model=list[ActivityEventOut])
def get_loan_activity(
    loan_id: UUID,
    limit: int = 60,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified activity feed: notes, status changes, condition changes, document uploads."""
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    events: list[ActivityEventOut] = []

    # Status events
    for e in db.query(LoanStatusEvent).filter(LoanStatusEvent.loan_id == loan.id).all():
        actor = e.actor.full_name or e.actor.email if e.actor else None
        to_l = _STATUS_LABELS.get(e.to_status, e.to_status)
        from_l = _STATUS_LABELS.get(e.from_status, e.from_status) if e.from_status else None
        detail = f"{from_l} → {to_l}" if from_l else f"Status → {to_l}"
        events.append(ActivityEventOut(
            id=f"status:{e.id}",
            event_type="status_change",
            occurred_at=e.occurred_at,
            actor_name=actor,
            detail=detail,
            body=e.reason,
        ))

    # Notes
    for n in db.query(Note).filter(Note.loan_id == loan.id, Note.tenant_id == current_user.tenant_id).all():
        author = n.creator.full_name or n.creator.email if n.creator else None
        events.append(ActivityEventOut(
            id=f"note:{n.id}",
            event_type="note",
            occurred_at=n.created_at,
            actor_name=author,
            detail="Note",
            body=n.body,
        ))

    # Condition changes
    for c in db.query(Condition).filter(Condition.loan_id == loan.id, Condition.tenant_id == current_user.tenant_id).all():
        events.append(ActivityEventOut(
            id=f"condition:created:{c.id}",
            event_type="condition_change",
            occurred_at=c.created_at,
            detail=f"Condition added: {c.name}",
        ))
        if c.status != "open" and c.updated_at > c.created_at:
            events.append(ActivityEventOut(
                id=f"condition:updated:{c.id}",
                event_type="condition_change",
                occurred_at=c.updated_at,
                detail=f"Condition {c.status}: {c.name}",
            ))

    # Document uploads
    for d in db.query(Document).filter(
        Document.loan_id == loan.id,
        Document.tenant_id == current_user.tenant_id,
        Document.archived_at.is_(None),
    ).all():
        uploader = d.uploader.full_name or d.uploader.email if d.uploader else None
        events.append(ActivityEventOut(
            id=f"document:{d.id}",
            event_type="document_upload",
            occurred_at=d.uploaded_at,
            actor_name=uploader,
            detail=f"Document: {d.file_name}",
        ))

    events.sort(key=lambda e: e.occurred_at, reverse=True)
    return events[:limit]


@router.post("/{loan_id}/notes", response_model=ActivityEventOut, status_code=status.HTTP_201_CREATED)
def create_loan_note(
    loan_id: UUID,
    payload: LoanNoteCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Post a note on the loan. Appears immediately in the activity feed."""
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    note = Note(
        tenant_id=current_user.tenant_id,
        loan_id=loan.id,
        body=payload.body,
        created_by=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return ActivityEventOut(
        id=f"note:{note.id}",
        event_type="note",
        occurred_at=note.created_at,
        actor_name=current_user.full_name or current_user.email,
        detail="Note",
        body=note.body,
    )
