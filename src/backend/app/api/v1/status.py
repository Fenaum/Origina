from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.loan import Loan
from app.models.workflow import LoanStatusEvent
from app.schemas.workflow_schema import StatusEventCreate, StatusEventOut
from app.security.security import get_audited_db, get_current_user
from app.models.user import User

router = APIRouter(prefix="/loans", tags=["status"])

# ── Allowed transitions (server-authoritative) ────────────────────────────────
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "new_draft":         ["submitted", "withdrawn", "cancelled"],
    "submitted":         ["conditions_review", "denied", "withdrawn", "cancelled"],
    "conditions_review": ["approved_pending", "approved", "denied", "withdrawn", "cancelled"],
    "approved_pending":  ["approved", "denied", "withdrawn", "cancelled"],
    "approved":          ["funded", "denied", "withdrawn", "cancelled"],
    "funded":            ["closed", "post_closing"],
    "closed":            ["post_closing", "archived"],
    "post_closing":      ["archived"],
    "denied":            [],
    "withdrawn":         [],
    "cancelled":         [],
    "archived":          [],
}

STATUS_LABELS = {
    "new_draft":         "New Draft",
    "submitted":         "Submitted",
    "conditions_review": "Conditions Review",
    "approved_pending":  "Approved Pending",
    "approved":          "Approved",
    "funded":            "Funded",
    "closed":            "Closed",
    "post_closing":      "Post Closing",
    "denied":            "Denied",
    "withdrawn":         "Withdrawn",
    "cancelled":         "Cancelled",
    "archived":          "Archived",
}

TERMINAL_STATUSES = {"denied", "withdrawn", "cancelled", "archived"}


def _get_or_404(loan_id: UUID, db: Session, tenant_id: UUID) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.get("/{loan_id}/status")
def get_loan_status(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    current = str(loan.status)
    available = ALLOWED_TRANSITIONS.get(current, [])
    return {
        "loan_id": str(loan_id),
        "current_status": current,
        "current_status_label": STATUS_LABELS.get(current, current),
        "is_terminal": current in TERMINAL_STATUSES,
        "available_transitions": [
            {"status": s, "label": STATUS_LABELS.get(s, s)}
            for s in available
        ],
    }


@router.get("/{loan_id}/status/history", response_model=list[StatusEventOut])
def get_status_history(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_or_404(loan_id, db, current_user.tenant_id)
    return (
        db.query(LoanStatusEvent)
        .filter(
            LoanStatusEvent.loan_id == loan_id,
            LoanStatusEvent.tenant_id == current_user.tenant_id,
        )
        .order_by(LoanStatusEvent.occurred_at.asc())
        .all()
    )


@router.post("/{loan_id}/status/transition", response_model=StatusEventOut, status_code=status.HTTP_201_CREATED)
def transition_status(
    loan_id: UUID,
    payload: StatusEventCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    loan = _get_or_404(loan_id, db, current_user.tenant_id)
    current = str(loan.status)
    target = str(payload.to_status)

    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition from '{current}' to '{target}'. Allowed: {allowed}",
        )

    # Funding gate: block if required exception conditions are unsatisfied.
    # Loans with approved_with_conditions exceptions cannot fund until all
    # required conditions (pricing, escrow, LTV, etc.) are resolved.
    if target == "funded":
        from app.models.workflow import ExceptionDecisionCondition as _Cond, LoanException as _Exc
        pending = (
            db.query(_Cond)
            .join(_Exc, _Exc.id == _Cond.exception_id)
            .filter(
                _Exc.loan_id == loan_id,
                _Exc.tenant_id == current_user.tenant_id,
                _Exc.status == "approved_with_conditions",
                _Cond.status == "pending",
                _Cond.is_required.is_(True),
            )
            .count()
        )
        if pending:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Cannot fund: {pending} required exception condition(s) are still pending. "
                    "All required conditions must be satisfied or waived before funding."
                ),
            )

    event = LoanStatusEvent(
        tenant_id=current_user.tenant_id,
        loan_id=loan_id,
        from_status=current,
        to_status=target,
        reason=payload.reason or f"Status changed to {STATUS_LABELS.get(target, target)}",
        actor_user_id=current_user.id,
    )
    loan.status = target  # type: ignore[assignment]
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
