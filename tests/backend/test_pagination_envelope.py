# tests/backend/test_pagination_envelope.py
"""Pagination envelope tests. See ROADMAP.md §B and Sprint 2 §2.4."""
import pytest
from uuid import uuid4


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_pipeline_returns_paginated_envelope(client, db, seed_minimum):
    response = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=50",
        headers=_auth(seed_minimum["token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert "items" in body, "Response must have 'items' key"
    assert "total" in body, "Response must have 'total' key"
    assert isinstance(body["items"], list)
    assert isinstance(body["total"], int)
    assert len(body["items"]) <= 50


@pytest.mark.integration
async def test_pipeline_respects_limit(client, db, seed_minimum):
    r1 = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=2",
        headers=_auth(seed_minimum["token"]),
    )
    assert r1.status_code == 200
    assert len(r1.json()["items"]) <= 2


@pytest.mark.integration
async def test_pipeline_total_is_consistent(client, db, seed_minimum):
    """total should be the same regardless of skip/limit."""
    r1 = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=50",
        headers=_auth(seed_minimum["token"]),
    )
    r2 = await client.get(
        "/api/v1/loans/pipeline?skip=50&limit=50",
        headers=_auth(seed_minimum["token"]),
    )
    assert r1.json()["total"] == r2.json()["total"]


# ── Sprint 2 §2.4: every list endpoint returns the envelope ─────────────────

@pytest.mark.integration
async def test_all_list_endpoints_return_envelope(client, db, seed_minimum):
    """Every list endpoint returns {"items": [...], "total": n} — no bare
    lists remain after Sprint 2.4's consistency pass.
    """
    token = seed_minimum["token"]
    headers = _auth(token)
    endpoints = [
        "/api/v1/conditions/",
        "/api/v1/tasks/",
        "/api/v1/notes/",
        "/api/v1/users/",
        "/api/v1/audit-logs/",
        "/api/v1/snapshots/",
        "/api/v1/tenants/",
        "/api/v1/pricing-runs/",
        "/api/v1/eligibility-runs/",
        "/api/v1/exceptions/",
    ]
    for ep in endpoints:
        r = await client.get(ep, headers=headers)
        assert r.status_code == 200, f"{ep} returned {r.status_code}: {r.text}"
        body = r.json()
        assert isinstance(body, dict) and "items" in body and "total" in body, (
            f"{ep} does not return the pagination envelope: {type(body).__name__}: {body!r}"
        )
        assert isinstance(body["items"], list), f"{ep}['items'] is not a list"
        assert isinstance(body["total"], int), f"{ep}['total'] is not an int"

