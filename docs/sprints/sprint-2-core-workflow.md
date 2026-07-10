# Current Sprint — Sprint 2: Core Workflow

> **Sprint index:** [docs/sprints/README.md](sprints/README.md)
> **Previous sprint:** [Sprint 1 — Demo Unblocked (archived)](sprints/sprint-1-demo-unblocked.md)
> **Full backlog:** [ROADMAP.md](ROADMAP.md) | **Session log:** [BUILD_HISTORY.md](BUILD_HISTORY.md)
> **Detailed build spec:** [docs/sprints/sprint-2-build-spec.md](sprints/sprint-2-build-spec.md) ← read this before coding
>
> **Update this at the start of every session** — mark the active phase, note the session goal, update status.

---

## Sprint Goal

Multiple real users with different roles can use the platform.

**Sprint is done when:**
- A broker and an underwriter can each log in with their own accounts
- Each role sees the right pages (RBAC from DB, not email prefix)
- The underwriter can fully manage conditions on a loan (open → submit → clear / waive / reject)
- The condition state machine is enforced server-side (invalid transitions return 422)
- All B-gate tests from Sprints 1 + 2 are green

---

## Phases

### Phase 2.1 — Real Users + RBAC from DB
**Status:** Not started
**Est. effort:** ~1 session (backend only)
**Spec:** [sprint-2-build-spec.md §2.1](sprints/sprint-2-build-spec.md#phase-21--real-users--rbac-from-db)

| Task | File(s) | Notes |
|---|---|---|
| Remove `tenant_id` from `UserCreate` | `src/backend/app/schemas/user_schema.py` | Schema bug — should never be accepted from request body |
| Add `require_roles(IT_ADMIN)` to `create_user` | `src/backend/app/api/v1/users.py` | Currently any authenticated user can create a user |
| Add `POST /users/{user_id}/roles/{role_name}` + DELETE counterpart | `src/backend/app/api/v1/users.py` | Role assignment API — currently no way to assign roles via API |
| Add `GET /users/me` | `src/backend/app/api/v1/users.py` | Frontend `GET /auth/me` hydration pattern; place BEFORE `GET /{user_id}` |
| Fix `UserOut.roles` — currently always `[]` | `src/backend/app/schemas/user_schema.py` | Add `@model_validator(mode="before)` to extract `role.name` from each `UserRole` |
| Create `scripts/seed_roles_and_users.py` | `scripts/` | Replaces one-shot `bootstrap_user.py`; creates one user per role (admin, LO, processor, UW, AM) |
| Write `tests/backend/test_user_rbac.py` | `tests/backend/` | 4 tests — admin-only create, tenant-from-JWT not body, `/users/me` works, duplicate email → 409 |

**Phase done when:** Admin can create users via `POST /users/`. Non-admins get 403. `tenant_id` is silently dropped from the body. `GET /users/me` returns the current user with `roles: ["it_admin"]`.

---

### Phase 2.2 — Condition Lifecycle Service
**Status:** Not started
**Est. effort:** ~1 session (backend + frontend wiring)
**Spec:** [sprint-2-build-spec.md §2.2](sprints/sprint-2-build-spec.md#phase-22--condition-lifecycle-service)

| Task | File(s) | Notes |
|---|---|---|
| Create `app/services/condition_lifecycle.py` | new file | State machine + `assert_transition_allowed(current, target)` |
| Add `POST /conditions/{id}/submit` | `src/backend/app/api/v1/conditions.py` | Currently frontend PATCHes status="submitted", bypassing validation |
| Add `POST /conditions/{id}/reject` (underwriter + AM only) | `src/backend/app/api/v1/conditions.py` | Reuses `waive_reason` column for rejection reason; dedicated column deferred to Sprint 5 |
| Wire `assert_transition_allowed` into `clear_condition` + `waive_condition` | `src/backend/app/api/v1/conditions.py` | Prevents invalid transitions (e.g., `cleared → cleared`) |
| Update `conditionsService.submitCondition` to call POST `/submit` | `src/frontend/src/services/conditionsService.ts` | Frontend no longer bypasses lifecycle via PATCH |
| Add `conditionsService.rejectCondition` | `src/frontend/src/services/conditionsService.ts` | Required by Phase 2.3 UI work |
| Write `tests/backend/test_condition_lifecycle.py` | `tests/backend/` | 6 tests — open→submit, submit→clear, can't clear open, can't transition from terminal, waive open, reject submitted |

**Valid transitions:**
```
open       → submitted | waived
submitted  → cleared | waived | rejected
cleared    → ∅ (terminal)
waived     → ∅ (terminal)
rejected   → ∅ (terminal)
```

**Phase done when:** All 6 lifecycle tests pass. `assert_transition_allowed` covered at ≥90%. Frontend `submitCondition` calls `POST /submit` not PATCH. Clearing a `cleared` condition returns 422.

---

### Phase 2.3 — Conditions Workspace UI Verification
**Status:** Not started
**Est. effort:** ~1 session (frontend + tests)
**Spec:** [sprint-2-build-spec.md §2.3](sprints/sprint-2-build-spec.md#phase-23--conditions-workspace-ui-verification)

| Task | File(s) | Notes |
|---|---|---|
| Audit `WorkspaceConditions.tsx` end-to-end | `src/frontend/src/components/loans/workspace/WorkspaceConditions.tsx` | Verify Reject button, template picker, sequential `condition_number` |
| Add "Reject" action button (visible when `status === "submitted"`) | Same file | Wires to `rejectCondition` from Phase 2.2 |
| Verify template picker actually calls `createCondition` | Same file | Per spec — may currently only render UI without API call |
| Write `tests/frontend/WorkspaceConditions.test.tsx` | `tests/frontend/` | 2 tests — render without crash, correct status badges |

**Phase done when:** `WorkspaceConditions` renders real conditions from API. Reject action calls `/reject` endpoint. All 2 frontend tests pass.

---

### Phase 2.4 — Pagination Envelope on Remaining List Endpoints
**Status:** Not started
**Est. effort:** ~1 session (backend conversion + frontend unwrap)
**Spec:** [sprint-2-build-spec.md §2.4](sprints/sprint-2-build-spec.md#phase-24--pagination-envelope-on-remaining-list-endpoints)

| Task | File(s) | Notes |
|---|---|---|
| Move `PaginatedResponse` to `schemas/common_schema.py` | `src/backend/app/schemas/` | Keep re-export in `loan_schema.py` for backward compat |
| Convert bare-list endpoints to envelope | `conditions.py`, `workflow.py`, `users.py`, `audit.py`, `tenants.py`, `decisioning.py` (+ check borrowers/properties/documents/exceptions) | `query.count()` before `offset/limit` |
| Unwrap envelope in frontend services | `src/frontend/src/services/` | `conditionsService.listConditions` → `data.items`, plus tasks/notes consumers |
| Add `test_all_list_endpoints_return_envelope` | `tests/backend/test_pagination_envelope.py` | Asserts `{items, total}` on every list endpoint |

**Phase done when:** the envelope test passes for every listed endpoint and the frontend still renders conditions/tasks correctly.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 2.1 — Real Users + RBAC from DB | ✅ Complete | this session |
| 2.2 — Condition Lifecycle Service | ✅ Complete | this session |
| 2.3 — Conditions Workspace UI | ✅ Complete | this session |
| 2.4 — Pagination Envelope on Remaining Endpoints | ✅ Complete | this session |

---

## B-Gate Tests Checklist

Sprint 1 tests must remain green (regression). Sprint 2 adds:

- [x] `tests/backend/test_auth_secret_from_env.py` (Sprint 1, 4 tests — must stay green)
- [x] `tests/backend/test_cors.py` (Sprint 1, 2 tests — must stay green)
- [x] `tests/backend/test_pagination_envelope.py` (Sprint 1 base + Phase 2.4 envelope test)
- [x] `tests/backend/test_loan_submission_e2e.py` (Sprint 1 — 3 pass / 0 skip now)
- [x] `tests/backend/test_loan_financials_endpoint.py` (Sprint 1 — 4 pass / 0 skip now)
- [x] `tests/frontend/WorkspaceHome.test.tsx` (Sprint 1, 2 tests — must stay green)
- [x] `tests/backend/test_user_rbac.py` (Phase 2.1, 5 tests)
- [x] `tests/backend/test_condition_lifecycle.py` (Phase 2.2, 9 tests)
- [x] `tests/frontend/WorkspaceConditions.test.tsx` (Phase 2.3, 2 tests)
- [x] `test_all_list_endpoints_return_envelope` in `tests/backend/test_pagination_envelope.py` (Phase 2.4)
- [x] Sprint 1's 2 skipped multi-tenant tests un-skipped and green (new `seed_two_tenants` fixture)
- [x] `scripts/seed_roles_and_users.py` runs without error (idempotent re-run verified)

**Target coverage:** `app/services/condition_lifecycle.py` ≥ 90% (state machine — highest-risk surface in the codebase).

---

## Multi-Tenant Seed (slipped from Sprint 1)

Two Sprint 1 tests are skipped because `seed_minimum` in `tests/backend/conftest.py` only creates one tenant:
- `test_tenant_isolation_on_loan` (`test_loan_submission_e2e.py:101`)
- `test_financials_scoped_to_tenant` (`test_loan_financials_endpoint.py:77`)

**Sprint 2 plan:** extend `seed_minimum` to return a second-tenant token (or add a `seed_second_tenant` fixture) so both skipped tests can be un-skipped. This is a small task that should be picked up at the start of Phase 2.1 or as its own 30-min micro-phase.

---

## After This Sprint Completes

1. Write a completion summary below (what shipped, what slipped, lessons learned)
2. Copy this file → `docs/sprints/sprint-2-core-workflow.md`
3. Update `docs/sprints/README.md` — mark Sprint 2 complete, add archive link and completion date
4. Move all Sprint 2 ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Write a new `CURRENT_SPRINT.md` for Sprint 3 — Full Workspace

---

## Completion Summary
*(Sprint 2 closed this session.)*

**Completed:** All four phases (2.1, 2.2, 2.3, 2.4) plus the
multi-tenant seed recovery. Full B-gate suite green.

**Slipped to Sprint 3:** None — every Priority-2 backlog item in the
sprint spec shipped.

**Lessons learned:**
- `@model_validator(mode="before")` with SQLAlchemy ORM objects:
  materialise a plain dict rather than mutating the ORM in place.
  The original `object.__setattr__` approach was silently swallowed
  by SQLAlchemy's descriptors and returned `[]` until we switched
  to eager-loading `roles` + dict-out.
- `vi.mock(...)` factories run before module-level `const`s init.
  Use `vi.hoisted(...)` to define any data the factory references.
- New `seed_role_users` fixture lets role-protected endpoints
  (e.g. UW-only `/reject`) be exercised without depending on the
  it_admin seed token.
- The path-to-canonical duplication between `users.py` (`/users/me`
  with `UserOut`) and `users_me.py` (`/users/me` with `UserMeOut`)
  is the lowest-risk friction today but should consolidate in a
  later sprint — the existing Pydantic `model_validator` does the
  heavy lifting so either shape works.
