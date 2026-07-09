# tests/backend/test_user_rbac.py
"""User creation RBAC + role assignment tests. See Sprint 2 §2.1.

Verifies:
  - Tenant-scoped user creation (tenant_id from JWT, never from body)
  - Duplicate email 409
  - /users/me returns the current user with roles populated
  - /users/{id}/roles/{name} POST + DELETE happy path
  - Non-admin token cannot create a user (403)
"""
import uuid

import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_create_user_requires_it_admin(client, db, seed_minimum):
    """A non-admin user cannot create another user — gets 403."""
    token = seed_minimum["token"]  # it_admin token by default

    # 1. Admin creates a loan officer.
    r1 = await client.post(
        "/api/v1/users/",
        json={
            "email": "lo@test.dev",
            "full_name": "LO User",
            "password": "TestPass123!",
            "is_active": True,
        },
        headers=_auth(token),
    )
    assert r1.status_code == 201, r1.text
    lo_user_id = r1.json()["id"]

    # 2. Admin assigns a non-admin role to the new user.
    r_role = await client.post(
        f"/api/v1/users/{lo_user_id}/roles/loan_officer",
        headers=_auth(token),
    )
    assert r_role.status_code == 204, r_role.text

    # 3. Log in as the new non-admin to obtain a real bearer token.
    lo_login = await client.post(
        "/api/v1/auth/login",
        data={"username": "lo@test.dev", "password": "TestPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert lo_login.status_code == 200, lo_login.text
    lo_token = lo_login.json()["access_token"]

    # 4. Non-admin attempts to create another user — must get 403.
    r2 = await client.post(
        "/api/v1/users/",
        json={
            "email": "another@test.dev",
            "full_name": "Another",
            "password": "TestPass123!",
            "is_active": True,
        },
        headers=_auth(lo_token),
    )
    assert r2.status_code == 403, r2.text


@pytest.mark.integration
async def test_user_creation_uses_current_tenant(client, db, seed_minimum):
    """tenant_id in the request body is ignored — JWT wins."""
    token = seed_minimum["token"]
    fake_tenant_id = str(uuid.uuid4())

    r = await client.post(
        "/api/v1/users/",
        json={
            "email": "test2@test.dev",
            "full_name": "T",
            "password": "Pass123!",
            "is_active": True,
            "tenant_id": fake_tenant_id,
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    # tenant_id in the body MUST equal the seeded tenant, NOT the injected one.
    assert body["tenant_id"] == seed_minimum["tenant_id"]


@pytest.mark.integration
async def test_get_me_returns_current_user(client, db, seed_minimum):
    """GET /users/me returns the logged-in user with roles populated.

    Note: /users/me resolves to users_me router (registered first in main.py)
    which returns UserMeOut — same shape as UserOut with `email` + `roles`.
    """
    token = seed_minimum["token"]
    r = await client.get("/api/v1/users/me", headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    # conftest's seed_minimum uses email format test-<label>@origina.dev
    # (so parallel tenants in seed_two_tenants don't collide on UNIQUE).
    assert body["email"] == "test-Lender@origina.dev"
    assert "it_admin" in body["roles"]



@pytest.mark.integration
async def test_duplicate_email_returns_409(client, db, seed_minimum):
    """Tenant-scoped unique email — a second POST with the same email → 409."""
    token = seed_minimum["token"]
    payload = {
        "email": "dup@test.dev",
        "full_name": "Dup",
        "password": "Pass123!",
        "is_active": True,
    }
    r1 = await client.post("/api/v1/users/", json=payload, headers=_auth(token))
    assert r1.status_code == 201, r1.text
    r2 = await client.post("/api/v1/users/", json=payload, headers=_auth(token))
    assert r2.status_code == 409, r2.text


@pytest.mark.integration
async def test_role_assign_and_remove_round_trip(client, db, seed_minimum):
    """POST /users/{id}/roles/{name} then DELETE — idempotent assign, real delete."""
    token = seed_minimum["token"]

    # Create a target user
    r = await client.post(
        "/api/v1/users/",
        json={
            "email": "target@test.dev",
            "full_name": "Target",
            "password": "Pass123!",
            "is_active": True,
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    target_id = r.json()["id"]

    # Assign a role (idempotent — calling twice still 204)
    a1 = await client.post(
        f"/api/v1/users/{target_id}/roles/loan_officer",
        headers=_auth(token),
    )
    assert a1.status_code == 204, a1.text
    a2 = await client.post(
        f"/api/v1/users/{target_id}/roles/loan_officer",
        headers=_auth(token),
    )
    assert a2.status_code == 204, a2.text

    # Verify the role shows up in the user's roles list
    g = await client.get(f"/api/v1/users/{target_id}", headers=_auth(token))
    assert g.status_code == 200, g.text
    # /users/{id} returns UserOut; sprint 2 validator now extracts role names.
    assert "loan_officer" in g.json()["roles"]

    # Remove the role
    d = await client.delete(
        f"/api/v1/users/{target_id}/roles/loan_officer",
        headers=_auth(token),
    )
    assert d.status_code == 204, d.text
    g2 = await client.get(f"/api/v1/users/{target_id}", headers=_auth(token))
    assert "loan_officer" not in g2.json()["roles"]
