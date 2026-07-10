"""
Domain event emitter + dispatcher.

Sprint 4 §4.4. emit_event() writes an event row using the caller's session —
the SAME transaction as the state change. The caller commits. Never commit
inside emit_event; that would split the atomicity guarantee.

dispatch_pending_events() is the fan-out: reads unprocessed events, routes
each to its consumers (email today), marks processed. Runs after request
commit via FastAPI BackgroundTasks, and once at startup to pick up anything
missed. Consumers must be idempotent — delivery is at-least-once.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.events import DomainEvent

log = logging.getLogger("origina_backend")


def emit_event(
    db: Session,
    *,
    tenant_id: UUID,
    event_type: str,
    entity_type: str,
    entity_id: UUID,
    payload: dict[str, Any] | None = None,
) -> DomainEvent:
    """
    Append a new DomainEvent to the caller's session. Caller commits.

    Returns the staged (uncommitted) event so tests can read the row id
    immediately after the commit.
    """
    event = DomainEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    return event


def dispatch_pending_events(db: Session, limit: int = 100) -> int:
    """
    Process unprocessed events. Returns count handled. Never raises —
    a failing consumer must not block the queue or other events.
    """
    # Local import keeps the consumer module optional (e.g. tests can
    # monkeypatch the path without importing the real SMTP code).
    from app.services import notification_consumer

    events = (
        db.query(DomainEvent)
        .filter(DomainEvent.processed_at.is_(None))
        .order_by(DomainEvent.occurred_at)
        .limit(limit)
        .all()
    )
    handled = 0
    for event in events:
        try:
            notification_consumer.handle(db, event)
        except Exception:
            log.exception(
                "Event consumer failed for %s %s", event.event_type, event.id
            )
        event.processed_at = datetime.now(timezone.utc)
        handled += 1
    db.commit()
    return handled


def run_dispatch_in_background() -> None:
    """
    Open a fresh DB session, dispatch pending events, close the session.
    Use via FastAPI BackgroundTasks — never block the response.
    """
    from app.core.db import SessionLocal

    db = SessionLocal()
    try:
        dispatch_pending_events(db)
    except Exception:
        log.exception("Background event dispatch failed")
    finally:
        db.close()
