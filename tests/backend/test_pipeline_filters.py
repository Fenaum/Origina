"""Pipeline assignment + filter tests — Sprint 4 §4.1.

The pipeline endpoint must surface the assigned user (so the grid can render
an Owner column) and must accept two optional query filters:
  ?assigned_to=<uuid>  — restrict to a single owner's pipeline
  ?status_filter=<status> — restrict to a single loan status
"""
from sqlalchemy import text

import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_pipeline_includes_assigned_to_name(client, db, seed_minimum):
    token = seed_minimum["token"]
    user_id = seed_minimum["user_id"]

    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    # Assign the loan to the seed admin (it_admin role).
    db.execute(
        text("UPDATE loans SET assigned_to = :uid WHERE id = :lid"),
        {"uid": user_id, "lid": loan_id},
    )
    db.commit()

    pipeline_r = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=100",
        headers=_auth(token),
    )
    assert pipeline_r.status_code == 200
    items = pipeline_r.json()["items"]
    target = next((i for i in items if i["id"] == loan_id), None)
    assert target is not None, "Newly created loan should appear in pipeline"
    assert target["assigned_to"] == user_id
    assert target["assigned_to_name"] is not None
    assert target["assigned_to_name"].startswith("Test ")
    assert target["assigned_to_name"].endswith("Admin")


@pytest.mark.integration
async def test_pipeline_filter_by_status(client, db, seed_minimum):
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

    r = await client.get(
        "/api/v1/loans/pipeline?status_filter=submitted",
        headers=_auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert all(i["status"] == "submitted" for i in body["items"]), \
        "All items must match the status filter"
    assert any(i["id"] == loan_id for i in body["items"])


@pytest.mark.integration
async def test_pipeline_filter_by_assigned_to(client, db, seed_minimum):
    """?assigned_to=<uuid> must scope the pipeline to one owner's loans.

    Setup: create two loans, assign one to the seed admin, leave the other
    unassigned. The ?assigned_to= filter must return only the assigned one.
    """
    token = seed_minimum["token"]
    user_id = seed_minimum["user_id"]

    # Loan A — assigned.
    a = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_a_id = a.json()["id"]
    db.execute(
        text("UPDATE loans SET assigned_to = :uid WHERE id = :lid"),
        {"uid": user_id, "lid": loan_a_id},
    )

    # Loan B — unassigned.
    b = await client.post(
        "/api/v1/loans/",
        json={"purpose": "refinance", "loan_program": "bank_statement"},
        headers=_auth(token),
    )
    loan_b_id = b.json()["id"]
    db.commit()

    r = await client.get(
        f"/api/v1/loans/pipeline?assigned_to={user_id}",
        headers=_auth(token),
    )
    assert r.status_code == 200
    items = r.json()["items"]
    ids = [i["id"] for i in items]
    assert loan_a_id in ids, "Assigned loan must be in the filtered pipeline"
    assert loan_b_id not in ids, "Unassigned loan must NOT be in the filtered pipeline"
