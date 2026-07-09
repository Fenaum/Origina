# tests/backend/test_condition_lifecycle.py
"""Condition lifecycle (state machine) tests — Sprint 2 §2.2.

Valid transitions:
  open       → submitted
  open       → waived
  submitted  → cleared | waived | rejected
  cleared    → ∅ (terminal)
  waived     → ∅ (terminal)
  rejected   → ∅ (terminal)

Coverage target: ≥ 90% on app.services.condition_lifecycle.
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


async def _seed_condition(client, token: str, loan_id: str, name: str = "Test Condition") -> dict:
    r = await client.post(
        "/api/v1/conditions/",
        json={
            "loan_id": loan_id,
            "name": name,
            "stage": "prior_to_approval",
            "condition_number": 1,
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── Valid transitions ────────────────────────────────────────────────────────

@pytest.mark.integration
async def test_submit_transitions_open_to_submitted(client, db, seed_minimum):
    """open → submitted."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    assert cond["status"] == "open"

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "submitted"


@pytest.mark.integration
async def test_clear_transitions_submitted_to_cleared(client, db, seed_minimum):
    """submitted → cleared, records cleared_by + cleared_at."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(token),
    )

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/clear",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "cleared"
    assert body["cleared_by"] is not None
    assert body["cleared_at"] is not None


@pytest.mark.integration
async def test_waive_open_condition_is_allowed(client, db, seed_minimum):
    """Underwriter can waive an open condition directly (open → waived)."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/waive",
        json={"reason": "Not applicable to this deal structure."},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "waived"
    assert body["waive_reason"] is not None


@pytest.mark.integration
async def test_reject_submitted_condition(client, db, seed_minimum, seed_role_users):
    """submitted → rejected, reason recorded on waive_reason column.

    Requires an `underwriter` or `account_manager` token — the seed admin's
    it_admin role is not authorized to reject (per Phase 2.2 RBAC).
    """
    uw_token = seed_role_users["underwriter"]["token"]
    loan_id = await _seed_loan(client, uw_token)
    cond = await _seed_condition(client, uw_token, loan_id)
    await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(uw_token),
    )

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/reject",
        json={"reason": "Documents do not match stated income."},
        headers=_auth(uw_token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "rejected"
    assert body["waive_reason"] is not None



# ── Invalid transitions (every one returns 422) ─────────────────────────────

@pytest.mark.integration
async def test_cannot_clear_open_condition(client, db, seed_minimum):
    """Clearing an `open` (not-yet-submitted) condition is not allowed."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/clear",
        headers=_auth(token),
    )
    assert r.status_code == 422, r.text


@pytest.mark.integration
async def test_cannot_transition_from_terminal_status(client, db, seed_minimum):
    """A `cleared` condition cannot be re-submitted — terminal state."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(token),
    )
    await client.post(
        f"/api/v1/conditions/{cond['id']}/clear",
        headers=_auth(token),
    )

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(token),
    )
    assert r.status_code == 422, r.text


@pytest.mark.integration
async def test_cannot_waive_cleared_condition(client, db, seed_minimum):
    """Terminal status: cleared cannot be waived."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(
        f"/api/v1/conditions/{cond['id']}/submit",
        headers=_auth(token),
    )
    await client.post(
        f"/api/v1/conditions/{cond['id']}/clear",
        headers=_auth(token),
    )

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/waive",
        json={"reason": "trying to waive a cleared one"},
        headers=_auth(token),
    )
    assert r.status_code == 422, r.text


@pytest.mark.integration
async def test_cannot_reject_open_condition(client, db, seed_minimum, seed_role_users):
    """Reject is only valid from `submitted` — not from `open`.

    Uses an underwriter token so 422 (state-machine) is exercised, not 403
    (role check).
    """
    uw_token = seed_role_users["underwriter"]["token"]
    loan_id = await _seed_loan(client, uw_token)
    cond = await _seed_condition(client, uw_token, loan_id)

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/reject",
        json={"reason": "premature"},
        headers=_auth(uw_token),
    )
    assert r.status_code == 422, r.text



# ── Service-level coverage ───────────────────────────────────────────────────

@pytest.mark.integration
async def test_condition_lifecycle_service_pure_function(monkeypatch):
    """Unit-level check of assert_transition_allowed — covers the service
    directly so the coverage gate can see the pure-function branch.
    """
    from app.services import condition_lifecycle as cl

    # Valid
    cl.assert_transition_allowed("open", "submitted")
    cl.assert_transition_allowed("open", "waived")
    cl.assert_transition_allowed("submitted", "cleared")
    cl.assert_transition_allowed("submitted", "waived")
    cl.assert_transition_allowed("submitted", "rejected")

    # Invalid (each raises 422)
    import fastapi
    for cur, tgt in [
        ("cleared", "submitted"),
        ("cleared", "waived"),
        ("cleared", "rejected"),
        ("waived", "cleared"),
        ("waived", "submitted"),
        ("rejected", "submitted"),
        ("open", "cleared"),       # open can't jump to cleared
        ("open", "rejected"),      # open can't jump to rejected
        ("submitted", "open"),     # can't go backwards
        ("unknown", "submitted"),  # unknown current status
    ]:
        with pytest.raises(fastapi.HTTPException) as exc:
            cl.assert_transition_allowed(cur, tgt)
        assert exc.value.status_code == 422
