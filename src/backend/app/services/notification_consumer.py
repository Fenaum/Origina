"""
First domain-event consumer: email notifications.

handle(db, event) is called by `event_service.dispatch_pending_events` for
every event. It decides whether this event type produces an email, resolves
recipients, and sends. Must be idempotent per event (at-least-once delivery).

This module is the ONLY place that knows notifications exist — the loan
routes know nothing about email.
"""
from __future__ import annotations

import logging
from sqlalchemy.orm import Session

from app.models.events import DomainEvent, EventType
from app.models.user import Role, User, UserRole
from app.services.notification_service import send_email

log = logging.getLogger("origina_backend")


def handle(db: Session, event: DomainEvent) -> None:
    """
    Route an event to its notification side-effects (if any).
    Failures must propagate so the dispatcher can log them, but the
    dispatcher catches everything so a single bad event cannot stall the
    queue.
    """
    if event.event_type == EventType.LOAN_SUBMITTED:
        _on_loan_submitted(db, event)
    elif event.event_type == EventType.LOAN_STATUS_CHANGED:
        if event.payload.get("to_status") == "conditions_review":
            _on_conditions_review(db, event)
    # Other event types: no notification (yet). Returning silently is the
    # contract — consumers decide when they have work to do.


def _loan_link(loan_id: str) -> str:
    return f"http://localhost:3000/loans/{loan_id}"


def _on_loan_submitted(db: Session, event: DomainEvent) -> None:
    """Notify the loan's assigned user that the file is ready for review."""
    assigned_to = event.payload.get("assigned_to")
    if not assigned_to:
        # No assignee — nothing to do. The event itself is still marked processed.
        return
    try:
        assignee_uuid = type(event.entity_id)(assigned_to) if isinstance(assigned_to, str) else assigned_to
    except (TypeError, ValueError):
        return
    assignee = db.get(User, assignee_uuid)
    if not assignee or not assignee.is_active:
        return
    send_email(
        to=assignee.email,
        subject=f"[Origina] Loan Submitted — {event.entity_id}",
        body=(
            "A loan has been submitted and is ready for review.\n\n"
            f"Loan ID: {event.entity_id}\n\n"
            f"Review it here: {_loan_link(str(event.entity_id))}\n"
        ),
    )


def _on_conditions_review(db: Session, event: DomainEvent) -> None:
    """Notify all underwriters that a file entered conditions review."""
    uw_role = (
        db.query(Role)
        .filter(
            Role.tenant_id == event.tenant_id,
            Role.name == "underwriter",
        )
        .first()
    )
    if not uw_role:
        return
    underwriters = (
        db.query(User)
        .join(UserRole, UserRole.user_id == User.id)
        .filter(
            UserRole.role_id == uw_role.id,
            UserRole.tenant_id == event.tenant_id,
            User.is_active.is_(True),
        )
        .all()
    )
    for uw in underwriters:
        send_email(
            to=uw.email,
            subject=f"[Origina] Conditions Review — {event.entity_id}",
            body=(
                "A loan has entered Conditions Review and requires underwriter attention.\n\n"
                f"Loan ID: {event.entity_id}\n\n"
                f"Review conditions here: {_loan_link(str(event.entity_id))}\n"
            ),
        )
