"""Sprint 5 §5.3 — tenant bootstrap endpoint tests."""
import pytest
from unittest.mock import patch

import app.api.v1.tenants as tenants_module


def _payload(secret: str = "test-secret", name: str = "Acme Lending") -> dict:
    return {
        "tenant_name": name,
        "admin_email": "admin@acme.com",
        "admin_full_name": "Acme Admin",
        "admin_password": "SecurePass123!",
        "admin_secret": secret,
    }


@pytest.mark.integration
async def test_bootstrap_creates_tenant_and_admin(client, db):
    """Happy path: tenant + first admin created in one call."""
    with patch.object(tenants_module, "ADMIN_SECRET", "test-secret-1234"):
        r = await client.post("/api/v1/tenants/bootstrap", json=_payload("test-secret-1234", "AcmeCo"))
    assert r.status_code == 201, r.text
    body = r.json()
    assert "tenant_id" in body
    assert body["email"] == "admin@acme.com"
    assert "AcmeCo" in body["message"]


@pytest.mark.integration
async def test_bootstrap_wrong_secret_returns_403(client, db):
    with patch.object(tenants_module, "ADMIN_SECRET", "correct-secret"):
        r = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("wrong-secret", "WrongCo"),
        )
    assert r.status_code == 403
    assert "Invalid admin secret" in r.json()["detail"]


@pytest.mark.integration
async def test_bootstrap_disabled_when_no_secret(client, db):
    """Empty ADMIN_SECRET → 503. Endpoint is opt-in."""
    with patch.object(tenants_module, "ADMIN_SECRET", ""):
        r = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("", "OrphanCo"),
        )
    assert r.status_code == 503
    assert "ADMIN_SECRET not set" in r.json()["detail"]


@pytest.mark.integration
async def test_bootstrap_duplicate_tenant_name_returns_409(client, db):
    with patch.object(tenants_module, "ADMIN_SECRET", "secret-xyz"):
        first = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("secret-xyz", "Dupe Lender"),
        )
        assert first.status_code == 201
        second = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("secret-xyz", "Dupe Lender"),
        )
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"]


@pytest.mark.integration
async def test_bootstrap_admin_can_log_in(client, db):
    """The freshly-bootstrapped admin can immediately authenticate."""
    with patch.object(tenants_module, "ADMIN_SECRET", "login-test"):
        r = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("login-test", "LoginCo"),
        )
        assert r.status_code == 201

    # Now log in as that admin
    login_r = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@acme.com", "password": "SecurePass123!"},
    )
    assert login_r.status_code == 200, login_r.text
    assert "access_token" in login_r.json()


@pytest.mark.integration
async def test_bootstrap_creates_it_admin_role_assignment(client, db):
    """The first user should have the it_admin role attached."""
    from sqlalchemy import text as sa_text
    with patch.object(tenants_module, "ADMIN_SECRET", "role-test"):
        r = await client.post(
            "/api/v1/tenants/bootstrap",
            json=_payload("role-test", "RoleCo"),
        )
        assert r.status_code == 201
        user_id = r.json()["user_id"]
        tenant_id = r.json()["tenant_id"]

    # Verify the role was attached
    result = db.execute(
        sa_text("""
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = :uid AND ur.tenant_id = :tid
        """),
        {"uid": user_id, "tid": tenant_id},
    ).fetchall()
    role_names = [row[0] for row in result]
    assert "it_admin" in role_names, f"Expected it_admin role, got {role_names}"
