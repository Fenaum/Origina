"""CM alert service.

Per PoC §14.1: notification fan-out is in-app list only. Alerts are written
to cm_alerts; the existing domain_events outbox + dispatcher (Sprint 4) is
the future fan-out seam — Milestone 3 may add a consumer for CM events.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import Alert, AlertStatus, AlertSeverity


def raise_alert(
    db: Session, *, tenant_id: UUID, loan_id: UUID,
    alert_type: str, severity: str, message: str,
    related_entity_type: str | None = None,
    related_entity_id: UUID | None = None,
    payload: dict[str, Any] | None = None,
    raised_by_user_id: UUID | None = None,
) -> Alert:
    """Insert a new alert row in OPEN status. Caller commits."""
    if severity not in AlertSeverity.ALL:
        raise ValueError(f"invalid severity {severity!r}; expected one of {sorted(AlertSeverity.ALL)}")
    if alert_type not in {
        "reprice_required", "eligibility_lost", "below_margin_floor",
        "lock_expired", "allocation_override",
    }:
        raise ValueError(f"invalid alert_type {alert_type!r}")

    alert = Alert(
        tenant_id=tenant_id,
        loan_id=loan_id,
        alert_type=alert_type,
        severity=severity,
        status=AlertStatus.OPEN,
        message=message,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        raised_at=datetime.now(timezone.utc),
        raised_by_user_id=raised_by_user_id,
        payload=payload or {},
    )
    db.add(alert)
    db.flush()
    return alert


def list_open_alerts(
    db: Session, *, tenant_id: UUID, loan_id: UUID | None = None, limit: int = 50,
) -> list[Alert]:
    q = (
        db.query(Alert)
        .filter(Alert.tenant_id == tenant_id, Alert.status == AlertStatus.OPEN)
        .order_by(Alert.raised_at.desc())
        .limit(limit)
    )
    if loan_id is not None:
        q = q.filter(Alert.loan_id == loan_id)
    return q.all()


def acknowledge_alert(
    db: Session, *, tenant_id: UUID, alert_id: UUID, actor_user_id: UUID,
) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None or alert.tenant_id != tenant_id:
        raise ValueError(f"alert {alert_id} not found for tenant")
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = actor_user_id
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.flush()
    return alert


def resolve_alert(
    db: Session, *, tenant_id: UUID, alert_id: UUID, actor_user_id: UUID,
) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None or alert.tenant_id != tenant_id:
        raise ValueError(f"alert {alert_id} not found for tenant")
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = actor_user_id
    alert.resolved_at = datetime.now(timezone.utc)
    db.flush()
    return alert
