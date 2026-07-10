"""Notes and audit log endpoint tests — Sprint 3 §3.1.

The workspace conversation pane and audit log read from these endpoints. They
also serve as the regression net for the pagination envelope on /notes/
and /audit-logs/ (already covered in test_pagination_envelope.py — we
re-confirm it here against a loan that has data).
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
async def test_create_and_list_notes(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    note_r = await client.post(
        "/api/v1/notes/",
        json={"loan_id": loan_id, "body": "Bank statements received."},
        headers=_auth(token),
    )
    assert note_r.status_code == 201, note_r.text
    note = note_r.json()
    assert note["body"] == "Bank statements received."
    assert note["created_by"] == seed_minimum["user_id"]
    assert note["loan_id"] == loan_id

    list_r = await client.get(
        f"/api/v1/notes/?loan_id={loan_id}",
        headers=_auth(token),
    )
    assert list_r.status_code == 200
    body = list_r.json()
    assert "items" in body, "Notes list should return the pagination envelope"
    assert any(n["id"] == note["id"] for n in body["items"])


@pytest.mark.integration
async def test_notes_are_tenant_isolated(client, db, seed_minimum):
    """A note written on loan A must not appear in a list for loan B.

    Notes carry tenant_id implicitly; the list query must filter by loan_id
    so a different loan's notes never bleed through. (Cross-tenant isolation
    is enforced by tenant_id in addition.)
    """
    token = seed_minimum["token"]
    loan1_id = await _seed_loan(client, token)
    loan2_id = await _seed_loan(client, token)

    await client.post(
        "/api/v1/notes/",
        json={"loan_id": loan1_id, "body": "Note for loan 1 only"},
        headers=_auth(token),
    )

    list_r = await client.get(
        f"/api/v1/notes/?loan_id={loan2_id}",
        headers=_auth(token),
    )
    assert list_r.status_code == 200
    body = list_r.json()
    assert body["total"] == 0, f"Loan 2 should have no notes; got {body['total']}"
    assert body["items"] == []


@pytest.mark.integration
async def test_audit_log_captures_loan_creation(client, db, seed_minimum):
    """POST /loans triggers the audit trigger on the loans table — the
    audit log for entity_id=<loan.id> must include at least one INSERT.
    """
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    audit_r = await client.get(
        f"/api/v1/audit-logs/?entity_id={loan_id}",
        headers=_auth(token),
    )
    assert audit_r.status_code == 200
    body = audit_r.json()
    assert "items" in body, "Audit log must return the pagination envelope"
    assert body["total"] >= 1
    actions = [e["action"].upper() for e in body["items"]]
    assert "INSERT" in actions, f"Expected an INSERT event; got {actions}"
    insert_event = next(e for e in body["items"] if e["action"].upper() == "INSERT")
    assert insert_event["entity_type"] == "loans"
    assert insert_event["entity_id"] == loan_id
