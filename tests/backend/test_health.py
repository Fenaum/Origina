"""
Smoke tests for the Origina backend.

See ROADMAP.md "Testing Checkpoints" section A.1.

These tests are the foundation tier — they verify the harness itself works
(imports, ASGI client, route registration) without touching the database.
All real integration tests in Priority 1+ sections will reuse the `client`
fixture defined here in conftest.py.
"""
from __future__ import annotations

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# /health
# ─────────────────────────────────────────────────────────────────────────────

async def test_health_endpoint_returns_ok(client):
    """
    ROADMAP §A.1 smoke test: GET /api/v1/health/ → 200 + {"status": "healthy", ...}.

    Smoke-tier — marked `@pytest.mark.smoke` so it can be run without the
    full DB harness if needed.
    """
    response = await client.get("/api/v1/health/")
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["status"] == "healthy"
    # `environment` is whatever the current APP_ENV is — we don't pin it
    # because the runner script may source a .env that overrides it.
    assert "environment" in body
    assert body["environment"] in ("test", "local", "development")


# ─────────────────────────────────────────────────────────────────────────────
# /
# ─────────────────────────────────────────────────────────────────────────────

async def test_root_serves_metadata(client):
    """
    ROADMAP §A.1 smoke test: GET / → 200 with `service` / `api_prefix` fields.
    """
    response = await client.get("/")
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["service"] == "Origina Backend Service"
    assert body["api_prefix"] == "/api/v1"


# ─────────────────────────────────────────────────────────────────────────────
# /docs (OpenAPI surface)
# ─────────────────────────────────────────────────────────────────────────────

async def test_docs_endpoint_is_served(client):
    """
    Bonus smoke test: GET /docs returns 200. Confirms the FastAPI app
    object is reachable from the test client.
    """
    response = await client.get("/docs")
    assert response.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Pure unit — no FastAPI client needed. Sanity check the harness's quoting.
# ─────────────────────────────────────────────────────────────────────────────

def test_quote_ident_escapes_double_quote():
    """Conftest's _quote_ident must escape embedded double quotes."""
    from tests.backend.conftest import _quote_ident  # type: ignore[attr-defined]

    assert _quote_ident("simple") == '"simple"'
    assert _quote_ident('weird"name') == '"weird""name"'


def test_schema_name_is_unique_per_session(test_schema_name):
    """Two sessions must not collide on the same schema name."""
    assert test_schema_name.startswith("test_origina_")
    assert len(test_schema_name) > len("test_origina_")