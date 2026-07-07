# tests/backend/test_pagination_envelope.py
"""Pagination envelope tests. See ROADMAP.md §B."""
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