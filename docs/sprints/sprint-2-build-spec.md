# Sprint 2 — Implementation Spec
## Core Workflow: Real Users + Conditions Managed

> **For:** MiniMax M3 (or any LLM/developer implementing this sprint)
> **Validated by:** Claude Code after completion
> **Sprint goal:** A broker and an underwriter can each log in with their own accounts, access the right pages, and the underwriter can fully manage conditions on a loan.
> **Prerequisite:** Sprint 1 must be complete and all its tests green before starting.

---

## Repo Context

```
src/backend/app/
  api/v1/
    users.py        ← User CRUD — has a schema bug to fix
    conditions.py   ← Condition endpoints — missing submit + reject dedicated endpoints
    workflow.py     ← Notes + Tasks endpoints (fully functional)
  schemas/
    user_schema.py  ← UserCreate has tenant_id that should not be accepted
  security/
    roles.py        ← require_roles() factory — already works
    security.py     ← get_current_user, get_audited_db
  services/         ← No condition_lifecycle.py yet — needs to be created

src/frontend/src/
  components/loans/workspace/WorkspaceConditions.tsx  ← UI exists, nearly complete
  services/conditionsService.ts                       ← Fully wired to real API
  hooks/useConditions.ts                              ← Works, useEffect-based
```

---

## Phase 2.1 — Real Users + RBAC from DB

**Goal:** Creating a user is restricted to admins, `tenant_id` is never accepted from the request body, every role has a seed user to log in with for testing, and the frontend/backend role vocabulary is reconciled.

### Role vocabulary reconciliation (do this first)

**Problem:** The backend and frontend use two different role vocabularies for the same concept:

- **Backend** (`src/backend/app/security/roles.py`, matches the `roles` DB table): `loan_officer`, `loan_processor`, `underwriter`, `account_manager`, `it_admin`
- **Frontend** (`src/frontend/src/types/auth.ts` `UserRole` + `Sidebar.tsx` nav arrays): `account_executive`, `broker`, `underwriter`, `processor`, `funder`, `manager`, `borrower`, `admin`, `it_admin`

Only `underwriter` and `it_admin` overlap. This means role-based sidebar filtering and page guards are checking against names the backend never issues — an RBAC correctness bug.

**Fix — the backend vocabulary is canonical:**

1. Read `src/frontend/src/types/auth.ts`. Update the `UserRole` type to the backend's five role names: `"loan_officer" | "loan_processor" | "underwriter" | "account_manager" | "it_admin"`. Keep `"borrower"` if the borrower intake flow depends on it (it is a frontend-only pseudo-role for unauthenticated intake — document that with a comment).
2. Update `roleLabels` and `roleDashboardPaths` in the same file to be keyed by the new names (e.g., `loan_officer: "Loan Officer"`, `account_manager: "Account Manager"`).
3. Update every `roles: [...]` array in `Sidebar.tsx` `navItems` to use backend names. Mapping: `account_executive`/`broker` → `loan_officer`, `processor` → `loan_processor`, `manager`/`funder` → `account_manager`, `admin` → `it_admin`.
4. Grep the frontend for the old names and update all `allowedRoles` props on pages: `grep -rn "account_executive\|'broker'\|\"broker\"\|'processor'\|'funder'\|'manager'" src/frontend/src/`
5. Verify `auth.tsx` derives the user's role from the backend's `GET /users/me` response `roles` array (first role, or highest-privilege) — not from an email prefix or a separate `user.role` string.

**Done when:** `npx tsc --noEmit` passes, and logging in as each seed user (created below) shows the correct sidebar items for that role.

### Bug to fix: `UserCreate` accepts `tenant_id`

**Current `src/backend/app/schemas/user_schema.py` `UserCreate`:**
```python
class UserCreate(UserBase):
    tenant_id: UUID       # ← BUG: should never be accepted from request body
    password: str
```

**Fix — remove `tenant_id` from `UserCreate`:**
```python
class UserCreate(UserBase):
    password: str
```

No other schema changes needed. `UserOut` already has `tenant_id` on the response, which is correct.

### Fix: `create_user` endpoint RBAC

**Current `src/backend/app/api/v1/users.py` `create_user`:**
```python
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
```

The body already uses `current_user.tenant_id` when building the User ORM object — that part is correct. What is missing: **no role enforcement**. Any authenticated user can create another user.

**Fix — add `require_roles` dependency:**
```python
from app.security.roles import IT_ADMIN, require_roles

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
```

### Add: `POST /users/{user_id}/roles` endpoint

Currently there is no way to assign a role to a user via the API. Add it to `users.py`:

```python
from app.models.user import Role, UserRole

@router.post("/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(
    user_id: UUID,
    role_name: str,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    user = _get_or_404(user_id, db, current_user.tenant_id)
    role = (
        db.query(Role)
        .filter(Role.tenant_id == current_user.tenant_id, Role.name == role_name)
        .first()
    )
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
    existing = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not existing:
        db.add(UserRole(user_id=user_id, role_id=role.id, tenant_id=current_user.tenant_id))
        db.commit()


@router.delete("/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role(
    user_id: UUID,
    role_name: str,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    user = _get_or_404(user_id, db, current_user.tenant_id)
    role = (
        db.query(Role)
        .filter(Role.tenant_id == current_user.tenant_id, Role.name == role_name)
        .first()
    )
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
    db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role.id,
        UserRole.tenant_id == current_user.tenant_id,
    ).delete()
    db.commit()
```

### Add: `GET /users/me` endpoint

Needed by the frontend `GET /auth/me` hydration pattern.

```python
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

**Add this BEFORE** `GET /{user_id}` in the file — FastAPI resolves routes top-to-bottom and "me" would otherwise match as a `user_id` UUID (which would fail parsing but still be confusing).

### Fix: `UserOut.roles` field

Currently `UserOut.roles: list[str] = []` but the ORM model `User.roles` is a `list[UserRole]`, not a list of strings. This means the response always returns `[]` for roles. Fix with a validator:

```python
from pydantic import model_validator

class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    roles: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def extract_role_names(cls, data: object) -> object:
        if hasattr(data, "roles"):
            role_objs = getattr(data, "roles", [])
            if role_objs and hasattr(role_objs[0], "role"):
                object.__setattr__(
                    data,
                    "roles",
                    [ur.role.name for ur in role_objs if ur.role],
                )
        return data
```

### Create: `scripts/seed_roles_and_users.py`

This replaces the use-once `bootstrap_user.py` with a repeatable seed that creates one user per role.

```python
#!/usr/bin/env python3
"""
Seed one user per role for the origina-dev tenant.

Run from repo root:
    python3 scripts/seed_roles_and_users.py

Idempotent — safe to re-run. Existing users are skipped.
"""
import os
import sys
from uuid import UUID

import bcrypt
import psycopg2

DB_URL = os.getenv("DATABASE_URL", "postgresql://origina:origina123@localhost:5432/originadb")

TENANT_NAME = "origina-dev"

SEED_USERS = [
    {"email": "admin@origina.dev",      "full_name": "Admin User",       "role": "it_admin",         "password": "TestPass123!"},
    {"email": "lo@origina.dev",         "full_name": "Loan Officer",      "role": "loan_officer",     "password": "TestPass123!"},
    {"email": "processor@origina.dev",  "full_name": "Processor User",    "role": "loan_processor",   "password": "TestPass123!"},
    {"email": "uw@origina.dev",         "full_name": "Underwriter User",  "role": "underwriter",      "password": "TestPass123!"},
    {"email": "am@origina.dev",         "full_name": "Account Manager",   "role": "account_manager",  "password": "TestPass123!"},
]


def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def run():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Get or create tenant
    cur.execute("SELECT id FROM tenants WHERE name = %s", (TENANT_NAME,))
    row = cur.fetchone()
    if row:
        tenant_id = row[0]
    else:
        cur.execute(
            "INSERT INTO tenants (name) VALUES (%s) RETURNING id",
            (TENANT_NAME,),
        )
        tenant_id = cur.fetchone()[0]
        print(f"Created tenant {TENANT_NAME} ({tenant_id})")

    for user in SEED_USERS:
        # Skip if email already exists for this tenant
        cur.execute(
            "SELECT id FROM users WHERE tenant_id = %s AND email = %s",
            (tenant_id, user["email"]),
        )
        existing = cur.fetchone()
        if existing:
            print(f"  Skipped (exists): {user['email']}")
            continue

        pw_hash = hash_pw(user["password"])
        cur.execute(
            """
            INSERT INTO users (tenant_id, email, full_name, password_hash, is_active)
            VALUES (%s, %s, %s, %s, true)
            RETURNING id
            """,
            (tenant_id, user["email"], user["full_name"], pw_hash),
        )
        user_id = cur.fetchone()[0]

        # Assign role
        cur.execute(
            "SELECT id FROM roles WHERE tenant_id = %s AND name = %s",
            (tenant_id, user["role"]),
        )
        role_row = cur.fetchone()
        if not role_row:
            print(f"  WARNING: Role '{user['role']}' not found for tenant {tenant_id}. Skipping role assignment.")
        else:
            cur.execute(
                "INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (user_id, role_row[0], tenant_id),
            )
        print(f"  Created: {user['email']} ({user['role']})")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    run()
```

### Write `tests/backend/test_user_rbac.py`

```python
# tests/backend/test_user_rbac.py
"""User creation RBAC + role assignment tests."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_create_user_requires_it_admin(client, db, seed_minimum):
    """A non-admin user cannot create another user — returns 403."""
    token = seed_minimum["token"]  # it_admin token

    # Create a non-admin user
    r1 = await client.post(
        "/api/v1/users/",
        json={"email": "lo@test.dev", "full_name": "LO User", "password": "TestPass123!", "is_active": True},
        headers=_auth(token),
    )
    assert r1.status_code == 201
    lo_user_id = r1.json()["id"]

    # Get a non-admin token by logging in as the new user
    # (we need to assign a non-admin role first)
    await client.post(f"/api/v1/users/{lo_user_id}/roles/loan_officer", headers=_auth(token))

    lo_login = await client.post(
        "/api/v1/auth/login",
        data={"username": "lo@test.dev", "password": "TestPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    lo_token = lo_login.json()["access_token"]

    # Non-admin tries to create a user — should get 403
    r2 = await client.post(
        "/api/v1/users/",
        json={"email": "another@test.dev", "full_name": "Another", "password": "TestPass123!", "is_active": True},
        headers=_auth(lo_token),
    )
    assert r2.status_code == 403


@pytest.mark.integration
async def test_user_creation_uses_current_tenant(client, db, seed_minimum):
    """tenant_id in the request body is ignored — always uses current_user's tenant."""
    token = seed_minimum["token"]
    import uuid
    fake_tenant_id = str(uuid.uuid4())

    r = await client.post(
        "/api/v1/users/",
        json={"email": "test2@test.dev", "full_name": "T", "password": "Pass123!", "is_active": True, "tenant_id": fake_tenant_id},
        headers=_auth(token),
    )
    assert r.status_code == 201
    assert r.json()["tenant_id"] == seed_minimum["tenant_id"]


@pytest.mark.integration
async def test_get_me_returns_current_user(client, db, seed_minimum):
    token = seed_minimum["token"]
    r = await client.get("/api/v1/users/me", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test@origina.dev"
    assert "it_admin" in body["roles"]


@pytest.mark.integration
async def test_duplicate_email_returns_409(client, db, seed_minimum):
    token = seed_minimum["token"]
    payload = {"email": "dup@test.dev", "full_name": "Dup", "password": "Pass123!", "is_active": True}
    r1 = await client.post("/api/v1/users/", json=payload, headers=_auth(token))
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/users/", json=payload, headers=_auth(token))
    assert r2.status_code == 409
```

**Phase 2.1 done when:** `./scripts/run_tests.sh` passes. Admin can create users. Non-admins get 403. `UserCreate` no longer accepts `tenant_id`. `GET /users/me` returns the logged-in user with `roles` populated.

---

## Phase 2.2 — Condition Lifecycle Service

**Goal:** A `condition_lifecycle.py` service validates state transitions before applying them. A dedicated `/submit` and `/reject` endpoint exist alongside `clear` and `waive`.

### What already works (do not change)
- `GET /conditions/` with `loan_id` filter — fully functional
- `POST /conditions/` — fully functional
- `PATCH /conditions/{id}` — used for name/description/stage edits only
- `POST /conditions/{id}/clear` — sets status to `cleared`, records `cleared_by` + `cleared_at`
- `POST /conditions/{id}/waive` — sets status to `waived`, records `cleared_by` + `waived_at` + `waive_reason`

### Create `src/backend/app/services/condition_lifecycle.py`

```python
"""
Condition lifecycle state machine.

Valid transitions:
  open       → submitted
  open       → waived   (underwriter can waive before any submission)
  submitted  → cleared
  submitted  → waived
  submitted  → rejected
  Any terminal status → (nothing)

Terminal statuses: cleared, waived, rejected
"""

from fastapi import HTTPException

from app.models.conditions import ConditionStatus


TRANSITIONS: dict[str, list[str]] = {
    ConditionStatus.OPEN:      [ConditionStatus.SUBMITTED, ConditionStatus.WAIVED],
    ConditionStatus.SUBMITTED: [ConditionStatus.CLEARED, ConditionStatus.WAIVED, ConditionStatus.REJECTED],
    ConditionStatus.CLEARED:   [],
    ConditionStatus.WAIVED:    [],
    ConditionStatus.REJECTED:  [],
}


def assert_transition_allowed(current: str, target: str) -> None:
    """Raises HTTP 422 if the transition current → target is not permitted."""
    allowed = TRANSITIONS.get(current, [])
    if target not in allowed:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Cannot transition condition from '{current}' to '{target}'. "
                f"Allowed from '{current}': {allowed or ['none — terminal status']}"
            ),
        )
```

### Update `src/backend/app/api/v1/conditions.py`

Import the lifecycle service and use it in `clear_condition`, `waive_condition`, plus the two new endpoints.

**Add import at top of file:**
```python
from app.services.condition_lifecycle import assert_transition_allowed
```

**Update `clear_condition`:**
```python
@router.post("/{condition_id}/clear", response_model=ConditionOut)
def clear_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, "cleared")    # ← add this
    condition.status = "cleared"
    condition.cleared_by = current_user.id
    condition.cleared_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(condition)
    return condition
```

**Update `waive_condition`:**
```python
@router.post("/{condition_id}/waive", response_model=ConditionOut)
def waive_condition(
    condition_id: UUID,
    payload: WaiveRequest = WaiveRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, "waived")    # ← add this
    condition.status = "waived"
    condition.waived_by = current_user.id
    condition.waived_at = datetime.now(timezone.utc)
    condition.waive_reason = payload.reason
    db.commit()
    db.refresh(condition)
    return condition
```

**Add `submit_condition` endpoint** (currently the frontend does PATCH to set status="submitted", which bypasses lifecycle validation):
```python
@router.post("/{condition_id}/submit", response_model=ConditionOut)
def submit_condition(
    condition_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, "submitted")
    condition.status = "submitted"
    db.commit()
    db.refresh(condition)
    return condition
```

**Add `reject_condition` endpoint:**
```python
class RejectRequest(BaseModel):
    reason: str | None = None

@router.post("/{condition_id}/reject", response_model=ConditionOut)
def reject_condition(
    condition_id: UUID,
    payload: RejectRequest = RejectRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(UNDERWRITER, ACCOUNT_MANAGER)),
):
    condition = _get_or_404(condition_id, db, current_user.tenant_id)
    assert_transition_allowed(condition.status, "rejected")
    condition.status = "rejected"
    # Reuse waive_reason column to store the rejection reason for now.
    # A dedicated rejected_reason column can be added in Sprint 5 hardening.
    condition.waive_reason = payload.reason
    db.commit()
    db.refresh(condition)
    return condition
```

**Also add to imports in conditions.py:**
```python
from app.security.roles import UNDERWRITER, ACCOUNT_MANAGER, require_roles
from pydantic import BaseModel as PydanticBaseModel  # avoid name clash with SQLAlchemy
```

### Update frontend `conditionsService.ts`

Change `submitCondition` to call the new dedicated endpoint:
```typescript
// BEFORE:
export async function submitCondition(id: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "submitted" }),
    token,
  });
}

// AFTER:
export async function submitCondition(id: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/submit`, { method: "POST", token });
}

// ADD:
export async function rejectCondition(id: string, reason: string | undefined, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    token,
  });
}
```

### Write `tests/backend/test_condition_lifecycle.py`

```python
# tests/backend/test_condition_lifecycle.py
"""Condition lifecycle state machine tests — target ≥90% coverage on condition_lifecycle.py."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _seed_condition(client, token, loan_id: str) -> dict:
    r = await client.post(
        "/api/v1/conditions/",
        json={"loan_id": loan_id, "name": "Test Condition", "stage": "prior_to_approval", "condition_number": 1},
        headers=_auth(token),
    )
    assert r.status_code == 201
    return r.json()


async def _seed_loan(client, token) -> str:
    r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.integration
async def test_submit_transitions_open_to_submitted(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    assert cond["status"] == "open"

    r = await client.post(f"/api/v1/conditions/{cond['id']}/submit", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "submitted"


@pytest.mark.integration
async def test_clear_transitions_submitted_to_cleared(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(f"/api/v1/conditions/{cond['id']}/submit", headers=_auth(token))

    r = await client.post(f"/api/v1/conditions/{cond['id']}/clear", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "cleared"
    assert r.json()["cleared_by"] is not None
    assert r.json()["cleared_at"] is not None


@pytest.mark.integration
async def test_cannot_clear_open_condition(client, db, seed_minimum):
    """Clearing an open condition (not yet submitted) is not allowed."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)

    r = await client.post(f"/api/v1/conditions/{cond['id']}/clear", headers=_auth(token))
    assert r.status_code == 422


@pytest.mark.integration
async def test_cannot_transition_from_terminal_status(client, db, seed_minimum):
    """A cleared condition cannot be submitted again."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(f"/api/v1/conditions/{cond['id']}/submit", headers=_auth(token))
    await client.post(f"/api/v1/conditions/{cond['id']}/clear", headers=_auth(token))

    r = await client.post(f"/api/v1/conditions/{cond['id']}/submit", headers=_auth(token))
    assert r.status_code == 422


@pytest.mark.integration
async def test_waive_open_condition_is_allowed(client, db, seed_minimum):
    """Underwriter can waive a condition directly from open (without submit step)."""
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/waive",
        json={"reason": "Not applicable to this deal structure."},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "waived"
    assert r.json()["waive_reason"] is not None


@pytest.mark.integration
async def test_reject_submitted_condition(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)
    cond = await _seed_condition(client, token, loan_id)
    await client.post(f"/api/v1/conditions/{cond['id']}/submit", headers=_auth(token))

    r = await client.post(
        f"/api/v1/conditions/{cond['id']}/reject",
        json={"reason": "Documents do not match stated income."},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
```

**Phase 2.2 done when:** All 6 lifecycle tests pass. `assert_transition_allowed` is covered at ≥90%. The frontend's `submitCondition` calls the POST `/submit` endpoint, not PATCH. Waiving an open condition works. Clearing a cleared condition returns 422.

---

## Phase 2.3 — Conditions Workspace UI Verification

**Goal:** Verify `WorkspaceConditions.tsx` is fully functional end-to-end. Add the `rejectCondition` call to the UI (it was wired on the backend in 2.2 but not in the component).

### What to audit first

Read `src/frontend/src/components/loans/workspace/WorkspaceConditions.tsx` fully before coding. Look for:

1. **The action buttons** — does the component have a "Reject" button that calls `rejectCondition`? If not, add it alongside the Clear and Waive buttons in the action menu.
2. **The template picker** — does `TemplatePickerModal` actually call `createCondition` with the template data? If it only shows a UI but doesn't write to the API, fix the `onAdd` handler.
3. **The `condition_number` field** — when adding a new condition, `condition_number` must be an integer. Verify the form assigns a sequential number (e.g., `conditions.length + 1`) before calling `createCondition`.

### Add "Reject" action to WorkspaceConditions

Find the action dropdown or button group in the component that shows "Clear" and "Waive" options. Add:

```tsx
import { rejectCondition } from "@/services/conditionsService";

// In the action handler section:
async function handleReject(conditionId: string) {
  if (!token) return;
  const reason = window.prompt("Rejection reason (optional):") ?? undefined;
  await rejectCondition(conditionId, reason, token);
  refetch();
}
```

Add the Reject button in the action UI, visible only when `condition.status === "submitted"` (same visibility rule as Clear).

### Write `tests/frontend/WorkspaceConditions.test.tsx`

```tsx
// tests/frontend/WorkspaceConditions.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ConditionOut } from "@/types/api";

const mockConditions: ConditionOut[] = [
  {
    id: "cond-1",
    loan_id: "loan-1",
    tenant_id: "tenant-1",
    name: "Proof of Income",
    description: "Last 2 years bank statements",
    condition_number: 1,
    status: "open",
    stage: "prior_to_approval",
    cleared_by: null,
    cleared_at: null,
    waived_by: null,
    waived_at: null,
    waive_reason: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  },
  {
    id: "cond-2",
    loan_id: "loan-1",
    tenant_id: "tenant-1",
    name: "Property Appraisal",
    description: null,
    condition_number: 2,
    status: "submitted",
    stage: "prior_to_docs",
    cleared_by: null,
    cleared_at: null,
    waived_by: null,
    waived_at: null,
    waive_reason: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  },
];

vi.mock("@/hooks/useConditions", () => ({
  useConditions: () => ({ conditions: mockConditions, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({ token: "mock-token", user: { id: "u1", role: "underwriter" } }),
}));

vi.mock("@/services/conditionsService", () => ({
  clearCondition: vi.fn().mockResolvedValue({ ...mockConditions[1], status: "cleared" }),
  waiveCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], status: "waived" }),
  rejectCondition: vi.fn().mockResolvedValue({ ...mockConditions[1], status: "rejected" }),
  createCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], id: "cond-3" }),
  submitCondition: vi.fn().mockResolvedValue({ ...mockConditions[0], status: "submitted" }),
  deleteCondition: vi.fn().mockResolvedValue(undefined),
  updateCondition: vi.fn().mockResolvedValue(mockConditions[0]),
}));

const mockLoan = {
  id: "loan-1",
  loanNumber: "OR-1001",
  borrowerName: "Jane Smith",
  status: "conditions_review",
  loanAmount: 450000,
  loanProgram: "dscr",
  channel: "Broker",
  propertyState: "FL",
  owner: "—",
  conditionsOpen: 1,
  conditionsSubmitted: 1,
  actionsNeeded: 2,
  submittedAt: "2026-07-01",
  updatedAt: "2026-07-01",
};

import { WorkspaceConditions } from "@/components/loans/workspace/WorkspaceConditions";

describe("WorkspaceConditions", () => {
  it("renders condition list without crashing", () => {
    render(<WorkspaceConditions loan={mockLoan} />);
    expect(screen.getByText("Proof of Income")).toBeInTheDocument();
    expect(screen.getByText("Property Appraisal")).toBeInTheDocument();
  });

  it("shows the correct status badge for each condition", () => {
    render(<WorkspaceConditions loan={mockLoan} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});
```

**Phase 2.3 done when:** `WorkspaceConditions` renders real conditions from the API. Reject action is present and calls the `/reject` endpoint. All 2 frontend tests pass. `./scripts/run_tests.sh` passes (all tests from sprints 1 and 2 green).

---

## Phase 2.4 — Pagination Envelope on Remaining List Endpoints

**Goal:** Every list endpoint returns `PaginatedResponse[T]` — no bare `list[X]` responses remain. Sprint 1 added the envelope to `/loans` and `/loans/pipeline` only; Sprints 3–4 will build UIs against the remaining endpoints, so this is the cheapest moment to do the consistency pass.

### Endpoints to convert

The `PaginatedResponse` generic already exists in `src/backend/app/schemas/loan_schema.py` (from Sprint 1). Move it to a shared location first:

1. Create `src/backend/app/schemas/common_schema.py`:
```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
```
2. Update `loan_schema.py` to import it from `common_schema` (keep a re-export for backward compatibility: `from app.schemas.common_schema import PaginatedResponse`).

Then convert each list endpoint. The pattern is identical everywhere — `query.count()` before applying `offset/limit`, return `PaginatedResponse(items=..., total=...)`:

| File | Endpoint | Current response |
|---|---|---|
| `api/v1/conditions.py` | `GET /conditions/` | `list[ConditionOut]` |
| `api/v1/workflow.py` | `GET /tasks/` | `list[TaskOut]` |
| `api/v1/workflow.py` | `GET /notes/` | `list[NoteOut]` |
| `api/v1/users.py` | `GET /users/` | `list[UserOut]` |
| `api/v1/audit.py` | `GET /audit-logs/` | `list[AuditLogOut]` |
| `api/v1/audit.py` | `GET /snapshots/` | `list[SnapshotOut]` |
| `api/v1/tenants.py` | `GET /tenants/` | `list[TenantOut]` |
| `api/v1/decisioning.py` | `GET /pricing-runs/` | `list[PricingRunOut]` |
| `api/v1/decisioning.py` | `GET /eligibility-runs/` | `list[EligibilityRunOut]` |

Also check `borrowers`, `properties`, `documents`, and `exceptions` routers for bare-list endpoints and convert them the same way.

### Frontend updates

Every frontend service that consumes a converted endpoint must unwrap the envelope. Grep for each endpoint path in `src/frontend/src/services/` and update the response type from `X[]` to `PaginatedResponse<X>`, reading `.items`. Known consumers:
- `conditionsService.ts` `listConditions` → `data.items`
- Any tasks/notes service calls in workspace components

### Test

Add to `tests/backend/test_pagination_envelope.py`:
```python
@pytest.mark.integration
async def test_all_list_endpoints_return_envelope(client, db, seed_minimum):
    """Every list endpoint returns {"items": [...], "total": n} — no bare lists."""
    token = seed_minimum["token"]
    headers = {"Authorization": f"Bearer {token}"}
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
    ]
    for ep in endpoints:
        r = await client.get(ep, headers=headers)
        assert r.status_code == 200, f"{ep} returned {r.status_code}"
        body = r.json()
        assert isinstance(body, dict) and "items" in body and "total" in body, (
            f"{ep} does not return the pagination envelope: {type(body)}"
        )
```

**Phase 2.4 done when:** the envelope test passes for every endpoint in the list, and the frontend still renders conditions/tasks correctly (envelope unwrapped in services).

---

## Sprint 2 B-gate checklist

- [ ] Sprint 1 tests (20) still green
- [ ] Role vocabulary reconciled — `tsc --noEmit` passes, sidebar correct per role (Phase 2.1)
- [ ] `tests/backend/test_user_rbac.py` (4 new tests)
- [ ] `tests/backend/test_condition_lifecycle.py` (6 new tests)
- [ ] `tests/frontend/WorkspaceConditions.test.tsx` (2 new tests)
- [ ] `test_all_list_endpoints_return_envelope` passes (Phase 2.4)
- [ ] The 2 tests skipped in Sprint 1 (multi-tenant seed) are un-skipped and green
- [ ] `scripts/seed_roles_and_users.py` runs without error
- [ ] Manual: log in as `uw@origina.dev` → open a loan → conditions panel shows real conditions → clear a submitted condition succeeds → clearing an open condition shows an error
