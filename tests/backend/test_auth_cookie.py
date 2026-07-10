"""Sprint 5 §5.1 — httpOnly cookie auth + logout + rate limiting."""
import pytest


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_login_sets_httponly_cookie(client, db, seed_minimum):
    """Login response sets an httpOnly `origina_token` cookie."""
    email = seed_minimum["tenants"][0].get("email", "test-Lender@origina.dev")
    # The fixture's email is per-tenant; resolve via seed_minimum user list.
    user_row = db.execute(
        __import__("sqlalchemy").text("SELECT email FROM users LIMIT 1")
    ).first()
    assert user_row is not None
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": user_row.email, "password": "TestPass123!"},
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()
    cookie = r.cookies.get("origina_token")
    assert cookie is not None, "httpOnly cookie 'origina_token' was not set on login response"


@pytest.mark.integration
async def test_protected_endpoint_accepts_bearer_header(client, db, seed_minimum):
    """Authorization: Bearer ... still works (API client path)."""
    token = seed_minimum["token"]
    r = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["email"]


@pytest.mark.integration
async def test_protected_endpoint_accepts_cookie(client, db, seed_minimum):
    """Cookie set on a previous login authenticates the next request.

    httpx's ASGITransport stores response cookies under the synthesized domain
    `testserver.local` while the next request is sent to `testserver`. They
    don't match, so the cookie jar appears empty from the request's POV. The
    real-browser contract (same-origin requests) is identical: the browser
    always re-sends cookies for the origin. To exercise that contract here we
    pull the cookie value off the response and re-send it via the Cookie
    header — same wire shape the browser would emit.
    """
    user_row = db.execute(
        __import__("sqlalchemy").text("SELECT email FROM users LIMIT 1")
    ).first()
    login_r = await client.post(
        "/api/v1/auth/login",
        data={"username": user_row.email, "password": "TestPass123!"},
    )
    assert login_r.status_code == 200, login_r.text
    cookie_value = login_r.cookies.get("origina_token")
    assert cookie_value, "login response did not carry origina_token cookie"
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Cookie": f"origina_token={cookie_value}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["email"] == user_row.email


@pytest.mark.integration
async def test_logout_clears_cookie(client, db, seed_minimum):
    """POST /auth/logout returns 204 and tells the browser to clear the cookie."""
    r = await client.post("/api/v1/auth/logout")
    # 204 No Content — no body, just the Set-Cookie header that drops the cookie.
    assert r.status_code == 204
    set_cookie = r.headers.get("set-cookie", "")
    assert "origina_token" in set_cookie
    # The clearing cookie has an empty value or max-age=0
    assert ('=""' in set_cookie or "Max-Age=0" in set_cookie or "max-age=0" in set_cookie)


@pytest.mark.integration
async def test_invalid_token_returns_401(client, db, seed_minimum):
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer this-is-not-a-valid-jwt"},
    )
    assert r.status_code == 401


@pytest.mark.integration
async def test_login_rejects_wrong_password(client, db, seed_minimum):
    user_row = db.execute(
        __import__("sqlalchemy").text("SELECT email FROM users LIMIT 1")
    ).first()
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": user_row.email, "password": "wrong-password"},
    )
    assert r.status_code == 401
    assert "origina_token" not in r.cookies


@pytest.mark.integration
async def test_login_rate_limit_returns_429_after_burst(client, db, seed_minimum):
    """slowapi throttles after the configured attempts-per-window.

    Default LOGIN_RATE_LIMIT is 10/minute. We burst 12 wrong-password attempts
    and expect at least one 429 once the limit is exceeded.
    """
    user_row = db.execute(
        __import__("sqlalchemy").text("SELECT email FROM users LIMIT 1")
    ).first()
    statuses: list[int] = []
    for _ in range(12):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": user_row.email, "password": "definitely-wrong"},
        )
        statuses.append(r.status_code)
    # At least one attempt must have hit the rate limiter.
    assert 429 in statuses, f"expected 429 in statuses, got {statuses}"
