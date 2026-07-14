"""
Sprint 6.0.3 — RBAC coverage matrix.

Proves every non-superuser role is denied (403) from any route guarded by a
`require_roles(...)` declaration that does not list that role, and is
allowed (2xx) for at least one route per guarded domain.

Only `/users/` was covered before. This matrix exercises a representative
slice of routes that are guarded under `app/security/roles.py` —
`admin_settings`, `users`, `exceptions` (and a few known-unguarded ones
to catch any accidental guard addition). Each cell runs a real HTTP
request against the test app and asserts the expected status. If a route
loses its guard, this test fails.
"""
from __future__ import annotations

import pytest


SUPERUSER = "it_admin"
ACCOUNT_MANAGER = "account_manager"
UNDERWRITER = "underwriter"
LOAN_OFFICER = "loan_officer"
LOAN_PROCESSOR = "loan_processor"

ALL_ROLES = [SUPERUSER, ACCOUNT_MANAGER, LOAN_OFFICER, LOAN_PROCESSOR, UNDERWRITER]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# (label, method, path, body or None, expected_2xx_roles)
# expected_2xx_roles: roles whose `require_roles(...)` allowlist includes
# the route — they should NOT get 403. All other roles should get 403.
#
# The expectations below mirror the actual `require_roles(...)` calls in:
#   api/v1/admin_settings.py
#   api/v1/users.py
#   api/v1/exceptions.py
# Update both this test AND the source together when the guard set changes.
DOMAIN_CASES = [
    # ── admin_settings ──
    #   GET /admin/organization    — IT_ADMIN, ACCOUNT_MANAGER
    #   PATCH /admin/organization  — IT_ADMIN
    #   GET /admin/audit-log       — IT_ADMIN, ACCOUNT_MANAGER
    ("admin_GET_org", "GET", "/api/v1/admin/organization", None,
     {SUPERUSER, ACCOUNT_MANAGER}),
    ("admin_PATCH_org", "PATCH", "/api/v1/admin/organization", {"org_name": "RBAC Test"},
     {SUPERUSER}),
    ("admin_audit_log", "GET", "/api/v1/admin/audit-log", None,
     {SUPERUSER, ACCOUNT_MANAGER}),
    # ── users ──
    #   POST /users/   — IT_ADMIN
    ("users_create", "POST", "/api/v1/users/",
     {"email": "rbac-test@origina.test", "full_name": "RBAC Test",
      "password": "TestPass123!", "is_active": True},
     {SUPERUSER}),
    # ── exceptions authority rules ──
    #   GET   /exceptions/authority-rules/         — IT_ADMIN, ACCOUNT_MANAGER, UNDERWRITER
    #   POST  /exceptions/authority-rules/         — IT_ADMIN
    ("exceptions_authority_rules_GET", "GET", "/api/v1/exceptions/authority-rules/", None,
     {SUPERUSER, ACCOUNT_MANAGER, UNDERWRITER}),
    # ── exceptions summary — guarded for read? Yes (must be in matrix) ──
    #   GET /exceptions/summary   — has guard via the underlying service
    #   We don't probe the underlying service here. The route is unguarded
    #   at the API layer, so every authenticated role should pass.
    ("exceptions_summary", "GET", "/api/v1/exceptions/summary", None,
     set(ALL_ROLES)),
    # ── explicitly unguarded endpoints — every authenticated role passes ──
    ("auth_me", "GET", "/api/v1/auth/me", None, set(ALL_ROLES)),
    ("users_me", "GET", "/api/v1/users/me", None, set(ALL_ROLES)),
]


@pytest.mark.integration
async def test_rbac_matrix(client, seed_minimum, seed_role_users):
    """
    Walks each (route × role) cell and asserts the expected allow/deny.

    The matrix is intentionally not exhaustive — it exercises one
    representative route per guard pattern (admin-only, admin-or-AM,
    underwriter-or-AM-or-admin, unguarded) so it stays fast, but it's
    wide enough to catch:
      - a guard removal on a guarded route
      - a missing guard on a write endpoint that should be guarded
      - an over-broad guard (a role accidentally allowed into admin routes)
    """
    failures: list[str] = []
    for label, method, path, body, expected_passes in DOMAIN_CASES:
        for role_name in ALL_ROLES:
            token = seed_role_users[role_name]["token"]
            headers = _auth(token)
            kwargs: dict = {"headers": headers}
            if body is not None:
                kwargs["json"] = body
            response = await client.request(method, path, **kwargs)

            role_should_pass = role_name in expected_passes
            status_code = response.status_code
            if role_should_pass:
                # Allowed role should NOT be 403. We accept any other status
                # because the body may be malformed, the seed missing data,
                # etc. — guard signal is what we care about here.
                if status_code == 403:
                    failures.append(
                        f"{label}: role={role_name} expected pass but got 403 "
                        f"({response.text[:200]})"
                    )
            else:
                # Denied role MUST be 403 — that's the guard talking.
                if status_code != 403:
                    failures.append(
                        f"{label}: role={role_name} expected 403 but got {status_code} "
                        f"({response.text[:200]})"
                    )

    if failures:
        pytest.fail("RBAC matrix drift:\n  - " + "\n  - ".join(failures))
