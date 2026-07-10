"""Status transition tests — Sprint 3 §3.2.

The workspace Status tab uses these endpoints to drive the state machine UI.
We verify:
  1. A valid forward transition is accepted and a status event is recorded.
  2. An invalid transition (skipping a required intermediate state) is rejected.
  3. The history endpoint reflects every transition.
  4. Terminal statuses expose no further available transitions.
"""
import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _seed_loan(client, token: str) -> str:
    r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.integration
async def test_transition_new_draft_to_submitted(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted", "reason": "All docs received."},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["to_status"] == "submitted"
    assert body["from_status"] == "new_draft"
    assert body["reason"] == "All docs received."

    # And the loan's current status must reflect the transition.
    status_r = await client.get(
        f"/api/v1/loans/{loan_id}/status",
        headers=_auth(token),
    )
    assert status_r.status_code == 200
    assert status_r.json()["current_status"] == "submitted"


@pytest.mark.integration
async def test_invalid_transition_returns_422(client, db, seed_minimum):
    """new_draft cannot jump straight to approved — only the enumerated
    ALLOWED_TRANSITIONS list in status.py is accepted.
    """
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "approved"},
        headers=_auth(token),
    )
    assert r.status_code == 422, r.text


@pytest.mark.integration
async def test_status_history_grows_with_transitions(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    h1 = await client.get(
        f"/api/v1/loans/{loan_id}/status/history",
        headers=_auth(token),
    )
    assert h1.status_code == 200
    initial_count = len(h1.json())
    # The seed creates a 'new_draft' event, so we expect exactly 1 to start.
    assert initial_count == 1

    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    h2 = await client.get(
        f"/api/v1/loans/{loan_id}/status/history",
        headers=_auth(token),
    )
    assert h2.status_code == 200
    assert len(h2.json()) == initial_count + 1


@pytest.mark.integration
async def test_terminal_status_has_no_available_transitions(client, db, seed_minimum):
    """withdrawn is in TERMINAL_STATUSES — available_transitions must be empty."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    transition_r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "withdrawn"},
        headers=_auth(token),
    )
    assert transition_r.status_code == 201, transition_r.text

    status_r = await client.get(
        f"/api/v1/loans/{loan_id}/status",
        headers=_auth(token),
    )
    body = status_r.json()
    assert body["current_status"] == "withdrawn"
    assert body["is_terminal"] is True
    assert body["available_transitions"] == []
