"""
Regression coverage for BUG-2026-07-11-001.

Before the fix, `_platform_tenant_id()` used `Query.scalar()` without a LIMIT
clause, which raises `MultipleResultsFound` whenever the test schema contains
more than one tenant. Multi-tenant isolation tests seed a second tenant in the
same `pytest` session, which made the basic anonymous-intake `POST /sessions`
endpoint unreliable to test.

These tests deliberately seed two tenants, then call `POST /intake/sessions`
and confirm the endpoint returns 201. With the bug present, this would 500
with `MultipleResultsFound`.
"""
import uuid

import pytest
from sqlalchemy import text


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_intake_session_creates_with_two_tenants(client, db, seed_minimum):
    """BUG-2026-07-11-001 — `_platform_tenant_id()` must not raise when
    the schema already contains a second tenant."""
    # The `seed_minimum` fixture only inserted one — multi-tenant
    # isolation tests insert a second one between tests, so
    # re-establish that state here.
    db.execute(
        text("INSERT INTO tenants (id, name) VALUES (:id, :name)"),
        {"id": uuid.uuid4(), "name": f"Other Tenant {uuid.uuid4().hex[:8]}"},
    )
    db.commit()

    # Confirm both tenants actually exist in the schema.
    tenant_count = db.execute(text("SELECT count(*) FROM tenants")).scalar_one()
    assert tenant_count >= 2

    # The endpoint must succeed despite the multi-tenant schema.
    response = await client.post("/api/v1/intake/sessions", headers=_auth(seed_minimum["token"]))
    assert response.status_code == 201, response.text
    body = response.json()
    assert "id" in body
    assert "created_at" in body


@pytest.mark.integration
async def test_intake_session_creates_with_single_tenant(client, seed_minimum):
    """Sanity counterpart — the basic single-tenant case still works after
    the LIMIT 1 change. If the LIMIT accidentally dropped the only row,
    this would 500 with "No tenant available for anonymous intake"."""
    response = await client.post("/api/v1/intake/sessions", headers=_auth(seed_minimum["token"]))
    assert response.status_code == 201, response.text
    body = response.json()
    assert "id" in body
    assert "created_at" in body


@pytest.mark.integration
async def test_intake_session_returns_valid_uuid(client, db, seed_minimum):
    """BUG-2026-07-11-001 follow-up — the returned session id must round-trip
    to a row that exists in intake_sessions. If `_platform_tenant_id()` ever
    returns a tenant the schema doesn't know about (or NULL), the FK fails
    silently in some serializers; this asserts the FK actually held."""
    response = await client.post("/api/v1/intake/sessions", headers=_auth(seed_minimum["token"]))
    assert response.status_code == 201, response.text
    session_id = response.json()["id"]

    # The session should be queryable directly via the intake session id
    # using the answers endpoint as a probe.
    probe = await client.post(
        f"/api/v1/intake/sessions/{session_id}/answers",
        headers=_auth(seed_minimum["token"]),
        json={"question_key": "credit_range", "value": "720-759"},
    )
    assert probe.status_code in (200, 201), probe.text
