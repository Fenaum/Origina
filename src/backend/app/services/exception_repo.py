"""
Exception service — business logic for the exception module.

Authority checking:
  Default (no rules in DB): underwriter, account_manager, it_admin may approve.
  Tenant-configured rules in exception_authority_rules take precedence when present.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.workflow import (
    ExceptionComment,
    ExceptionDecision,
    ExceptionDecisionCondition,
    ExceptionDocument,
    ExceptionEvent,
    ExceptionStatus,
    LoanException,
)
from app.models.user import User

# ── Default approval authority (when no authority rules are configured) ────────
_DEFAULT_APPROVER_ROLES = {"underwriter", "account_manager", "it_admin"}

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}

# Statuses from which a decide() call is allowed
_DECIDABLE = frozenset({
    "open", "submitted", "assigned", "under_review", "additional_info_requested"
})

# Maps decision_type → the new exception status
_DECISION_STATUS_MAP: dict[str, str] = {
    "as_requested":          ExceptionStatus.APPROVED,
    "with_conditions":       ExceptionStatus.APPROVED_WITH_CONDITIONS,
    "denied":                ExceptionStatus.DENIED,
    "information_requested": ExceptionStatus.ADDITIONAL_INFO_REQUESTED,
}

# Terminal decision types: set decided_by/decided_at on the parent exception
_TERMINAL_DECISION_TYPES = frozenset({"as_requested", "with_conditions", "denied"})

_DECISION_EVENT_TYPE: dict[str, str] = {
    "as_requested":          "exception_approved",
    "with_conditions":       "exception_approved_with_conditions",
    "denied":                "exception_denied",
    "information_requested": "exception_info_requested",
}


def get_user_roles(user: User) -> set[str]:
    return {ur.role.name for ur in user.roles}


def can_approve(exception: LoanException, user: User, db: Session) -> bool:
    """
    Returns True if the user is allowed to approve/deny exceptions.
    Checks tenant-configured authority rules first, then falls back to defaults.
    """
    from app.models.workflow import ExceptionAuthorityRule

    user_roles = get_user_roles(user)

    rules = (
        db.query(ExceptionAuthorityRule)
        .filter(
            ExceptionAuthorityRule.tenant_id == user.tenant_id,
            ExceptionAuthorityRule.is_active.is_(True),
        )
        .all()
    )

    if not rules:
        return bool(user_roles & _DEFAULT_APPROVER_ROLES)

    exc_severity_rank = _SEVERITY_RANK.get(exception.severity, 0)

    for rule in rules:
        type_matches = rule.exception_type is None or rule.exception_type == exception.exception_type
        severity_matches = _SEVERITY_RANK.get(rule.max_severity, 3) >= exc_severity_rank
        role_matches = bool(user_roles & set(rule.allowed_roles or []))
        if type_matches and severity_matches and role_matches:
            return True

    return False


def log_event(
    db: Session,
    exception: LoanException,
    event_type: str,
    actor: User,
    metadata: dict[str, Any] | None = None,
) -> ExceptionEvent:
    event = ExceptionEvent(
        tenant_id=exception.tenant_id,
        exception_id=exception.id,
        event_type=event_type,
        actor_user_id=actor.id,
        event_data=metadata or {},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    return event


def decide_exception(
    db: Session,
    exception: LoanException,
    decision_type: str,
    rationale: str | None,
    conditions: list[dict[str, Any]],
    actor: User,
) -> ExceptionDecision:
    """
    Core decision function. Creates an ExceptionDecision record, creates any
    imposed conditions, and advances exception.status accordingly.
    Legacy approve/deny endpoints are thin wrappers around this function.
    """
    if exception.status not in _DECIDABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot decide on an exception with status '{exception.status}'.",
        )
    if not can_approve(exception, actor, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not authorized to decide on this exception.",
        )

    decision = ExceptionDecision(
        tenant_id=exception.tenant_id,
        exception_id=exception.id,
        decision_type=decision_type,
        decided_by=actor.id,
        rationale=rationale,
    )
    db.add(decision)
    db.flush()  # assign decision.id before creating conditions

    for c in conditions:
        cond = ExceptionDecisionCondition(
            tenant_id=exception.tenant_id,
            exception_id=exception.id,
            decision_id=decision.id,
            **c,
        )
        db.add(cond)

    exception.status = _DECISION_STATUS_MAP[decision_type]
    if decision_type in _TERMINAL_DECISION_TYPES:
        exception.decided_by = actor.id
        exception.decided_at = datetime.now(timezone.utc)

    log_event(db, exception, _DECISION_EVENT_TYPE[decision_type], actor, {
        "decision_id": str(decision.id),
        "rationale": rationale,
        "conditions_count": len(conditions),
    })
    db.commit()
    db.refresh(decision)
    return decision


def approve_exception(
    db: Session,
    exception: LoanException,
    reason: str | None,
    actor: User,
) -> LoanException:
    """Legacy wrapper: approve without imposing conditions."""
    decide_exception(db, exception, "as_requested", reason, [], actor)
    db.refresh(exception)
    return exception


def deny_exception(
    db: Session,
    exception: LoanException,
    reason: str | None,
    actor: User,
) -> LoanException:
    """Legacy wrapper: deny via the formal decision record."""
    decide_exception(db, exception, "denied", reason, [], actor)
    db.refresh(exception)
    return exception


def satisfy_condition(
    db: Session,
    condition: ExceptionDecisionCondition,
    actor: User,
) -> ExceptionDecisionCondition:
    if condition.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Condition is already '{condition.status}'.",
        )
    condition.status = "satisfied"
    condition.satisfaction_date = datetime.now(timezone.utc)
    condition.satisfaction_user_id = actor.id
    db.commit()
    db.refresh(condition)
    return condition


def waive_condition(
    db: Session,
    condition: ExceptionDecisionCondition,
    actor: User,
) -> ExceptionDecisionCondition:
    if condition.status not in ("pending", "expired"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot waive a condition with status '{condition.status}'.",
        )
    condition.status = "waived"
    condition.satisfaction_date = datetime.now(timezone.utc)
    condition.satisfaction_user_id = actor.id
    db.commit()
    db.refresh(condition)
    return condition


_WITHDRAWABLE = frozenset({
    "open", "draft", "submitted", "assigned", "under_review", "additional_info_requested"
})


def withdraw_exception(
    db: Session,
    exception: LoanException,
    reason: str | None,
    actor: User,
) -> LoanException:
    if exception.status not in _WITHDRAWABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot withdraw an exception with status '{exception.status}'.",
        )
    exception.status = "withdrawn"
    log_event(db, exception, "withdrawn", actor, {"reason": reason})
    db.commit()
    db.refresh(exception)
    return exception


def submit_exception(
    db: Session,
    exception: LoanException,
    actor: User,
) -> LoanException:
    from datetime import datetime, timezone
    from app.models.workflow import ExceptionStatus

    if exception.status not in ("open", "draft", "additional_info_requested"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit an exception with status '{exception.status}'.",
        )
    exception.status = ExceptionStatus.SUBMITTED
    exception.submitted_at = datetime.now(timezone.utc)
    log_event(db, exception, "exception_submitted", actor)
    db.commit()
    db.refresh(exception)
    return exception


def assign_exception(
    db: Session,
    exception: LoanException,
    assigned_to_id,
    actor: User,
) -> LoanException:
    from app.models.workflow import ExceptionStatus

    if exception.status not in ("submitted", "under_review"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot assign an exception with status '{exception.status}'.",
        )
    exception.assigned_to = assigned_to_id
    exception.status = ExceptionStatus.ASSIGNED
    log_event(db, exception, "exception_assigned", actor, {"assigned_to": str(assigned_to_id)})
    db.commit()
    db.refresh(exception)
    return exception


def add_comment(
    db: Session,
    exception: LoanException,
    body: str,
    is_internal: bool,
    actor: User,
) -> ExceptionComment:
    comment = ExceptionComment(
        tenant_id=exception.tenant_id,
        exception_id=exception.id,
        body=body,
        created_by=actor.id,
        is_internal=is_internal,
    )
    db.add(comment)
    log_event(db, exception, "comment_added", actor, {"is_internal": is_internal})
    db.commit()
    db.refresh(comment)
    return comment


def link_exception_to_loan(
    db: Session,
    exception: LoanException,
    loan_id: UUID,
    actor: User,
) -> LoanException:
    """Link an approved pre-file exception to a specific loan file."""
    from app.models.loan import Loan

    if exception.loan_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exception is already linked to a loan.",
        )
    approved = (ExceptionStatus.APPROVED, ExceptionStatus.APPROVED_WITH_CONDITIONS)
    if exception.status not in approved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Only approved exceptions can be linked to a loan. "
                f"Current status: {exception.status}"
            ),
        )
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != exception.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    exception.loan_id = loan_id
    exception.exception_source = "loan_file"
    exception.context_type = "loan_file"
    log_event(db, exception, "linked_to_loan", actor, {"loan_id": str(loan_id)})
    db.commit()
    db.refresh(exception)
    return exception


def attach_document(
    db: Session,
    exception: LoanException,
    document_id: UUID,
    actor: User,
) -> ExceptionDocument:
    existing = (
        db.query(ExceptionDocument)
        .filter(
            ExceptionDocument.exception_id == exception.id,
            ExceptionDocument.document_id == document_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This document is already attached to the exception.",
        )
    link = ExceptionDocument(
        tenant_id=exception.tenant_id,
        exception_id=exception.id,
        document_id=document_id,
        attached_by=actor.id,
    )
    db.add(link)
    log_event(db, exception, "document_attached", actor, {"document_id": str(document_id)})
    db.commit()
    db.refresh(link)
    return link
