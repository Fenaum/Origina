# tests/backend/test_cors.py
"""CORS policy tests. See ROADMAP.md §B.

The JWT-secret-from-env assertions live in `test_auth_secret_from_env.py`
to keep each B-gate test file focused on a single concern.
"""
import pytest


@pytest.mark.smoke
async def test_cors_allows_localhost(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.smoke
async def test_cors_allows_alternate_localhost_port(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://localhost:3001", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3001"


@pytest.mark.smoke
async def test_cors_blocks_unknown_origin(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://evil.example.com", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") != "http://evil.example.com"
