# tests/backend/test_cors.py
"""CORS policy tests. See ROADMAP.md §B."""
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
async def test_cors_blocks_unknown_origin(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://evil.example.com", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") != "http://evil.example.com"


@pytest.mark.smoke
async def test_default_jwt_secret_rejected_in_non_local_env(monkeypatch):
    """Server startup raises RuntimeError when APP_ENV != local and JWT_SECRET_KEY is the default."""
    import importlib
    import app.core.config as cfg_module

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "change-me-in-production")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set"):
        importlib.reload(cfg_module)