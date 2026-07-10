"""Domain events — transactional outbox.

Sprint 4 §4.4. See docs/DECISIONS.md "Domain Events via Transactional Outbox"
ADR for the rationale (atomic state change + event, at-least-once delivery,
consumers don't have to know about each other).

The `AppendOnlyModel` mixin provides id/tenant_id/created_at. We add
occurred_at (when the event was logically emitted — usually = created_at)
and processed_at (set by the dispatcher after consumers run).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AppendOnlyModel


# Canonical event-type strings. The DB enforces these via a CHECK
# constraint in 131_domain_events.sql; this class is the Python-side
# single source of truth so callers don't sprinkle string literals.
class EventType:
    LOAN_SUBMITTED      = "loan.submitted"
    LOAN_STATUS_CHANGED = "loan.status_changed"
    CONDITION_CLEARED   = "condition.cleared"
    CONDITION_REJECTED  = "condition.rejected"
    DOCUMENT_UPLOADED   = "document.uploaded"

    ALL: frozenset[str] = frozenset({
        LOAN_SUBMITTED,
        LOAN_STATUS_CHANGED,
        CONDITION_CLEARED,
        CONDITION_REJECTED,
        DOCUMENT_UPLOADED,
    })


class DomainEvent(AppendOnlyModel):
    """A single domain event row, written in the same transaction as the
    state change it describes. Processed by `event_service.dispatch_pending_events`.

    Never updated in place — only `processed_at` is stamped after delivery.
    """
    __tablename__ = "domain_events"

    event_type:   Mapped[str]              = mapped_column(String, nullable=False)
    entity_type:  Mapped[str]              = mapped_column(String, nullable=False)
    entity_id:    Mapped[UUID]             = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    payload:      Mapped[dict[str, Any]]  = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at:  Mapped[datetime]         = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)
