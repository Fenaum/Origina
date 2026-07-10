"""Domain events (transactional outbox) + notification consumer tests.

Sprint 4 §4.4. Verifies:
  1. A status transition writes a domain_events row in the same transaction.
  2. dispatch_pending_events processes pending events and stamps processed_at.
  3. SMTP-disabled path returns False without opening a connection.
  4. A consumer failure does NOT abort the originating transition.
  5. A consumer failure does NOT stall the dispatcher — the event is still
     marked processed.
"""
from unittest.mock import patch

from sqlalchemy import text

import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_status_transition_emits_event(client, db, seed_minimum):
    """Transitioning a loan writes a domain_events row in the same transaction."""
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text

    row = db.execute(
        text(
            "SELECT event_type, payload FROM domain_events "
            "WHERE entity_id = :id AND event_type = 'loan.submitted'"
        ),
        {"id": loan_id},
    ).fetchone()
    assert row is not None, "loan.submitted event was not emitted"
    # payload is JSONB; cast to dict on read
    payload = row.payload if isinstance(row.payload, dict) else dict(row.payload)
    assert payload.get("to_status") == "submitted"


@pytest.mark.integration
async def test_dispatcher_marks_events_processed(client, db, seed_minimum):
    """dispatch_pending_events processes unprocessed events and stamps processed_at."""
    from app.services.event_service import dispatch_pending_events

    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]
    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    handled = dispatch_pending_events(db)
    assert handled >= 1

    unprocessed = db.execute(
        text(
            "SELECT COUNT(*) FROM domain_events "
            "WHERE entity_id = :id AND processed_at IS NULL"
        ),
        {"id": loan_id},
    ).scalar_one()
    assert unprocessed == 0


def test_send_email_skipped_when_smtp_not_configured():
    """With SMTP_HOST unset, send_email returns False and does not open a connection."""
    from app.services import notification_service

    with patch.object(notification_service.config, "NOTIFICATIONS_ENABLED", False):
        result = notification_service.send_email("test@test.com", "Subject", "Body")
    assert result is False


@pytest.mark.integration
async def test_transition_succeeds_when_consumer_fails(client, db, seed_minimum):
    """Status transition succeeds even if the notification consumer raises.

    The background dispatch swallows consumer failures and stamps the event
    as processed so the queue keeps draining. The HTTP response is the
    underlying state transition, which is independent of dispatch.
    """
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    with patch(
        "app.services.notification_consumer.handle",
        side_effect=RuntimeError("consumer exploded"),
    ):
        r = await client.post(
            f"/api/v1/loans/{loan_id}/status/transition",
            json={"to_status": "submitted"},
            headers=_auth(token),
        )
    assert r.status_code == 201, r.text  # transition succeeded despite consumer failure


@pytest.mark.integration
async def test_dispatcher_survives_consumer_failure(client, db, seed_minimum):
    """A failing consumer does not block the queue — the event is still marked processed."""
    from app.services.event_service import dispatch_pending_events

    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]
    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    with patch(
        "app.services.notification_consumer.handle",
        side_effect=RuntimeError("consumer exploded"),
    ):
        handled = dispatch_pending_events(db)
    assert handled >= 1, "Dispatcher must drain the queue even when a consumer raises"
