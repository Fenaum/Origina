# Sprint 6 — Implementation Spec
## Closeout & UAT Response

> **For:** any LLM/developer implementing this sprint · **Validated by:** Claude Code after completion
> **Milestone:** [M2 — Operational Depth](MILESTONES.md) (sprint 1 of 5)
> **Sprint goal:** Clear the Sprint 1–5 audit debts, burn down UAT-1 findings, and close the workspace data gaps — so Sprints 7–10 build on a verified, fully-honest baseline.
> **Prerequisite:** Sprints 1–5 merged to `main`, CI green, UAT-1 underway (findings arriving in BUILD_HISTORY.md).

---

## Phase 6.0 — Sprint 1–5 Audit Closeout

Already specified in [CURRENT_SPRINT.md](../CURRENT_SPRINT.md). Summary of the four tasks:

1. **`tests/backend/test_rbac_coverage.py`** — parameterized role × route matrix. Build a table of `(role, method, path, expected_status)` covering at least one read + one write per domain router (loans, conditions, users, tenants, exceptions, documents, notes, tasks, admin_settings, analytics). Derive expectations from each route's `require_roles(...)` declaration — the test asserts the declaration is actually enforced (200/2xx for allowed, 403 for denied). Seed one user per role via the existing user-creation service.
2. **Un-skip the intake lifecycle test** (`test_coverage_gaps.py:1005`). The skip hides "Multiple rows were found when exactly one was required" — almost certainly a `.one()` in the intake service hitting duplicate rows. Diagnose whether it's a product bug (duplicate intake sessions possible in prod) or test seeding. If product bug: fix service (`.one()` → explicit uniqueness constraint or ordered `.first()` with a comment), log `BUG-` entry in BUILD_HISTORY.md, add a named regression test.
3. **Migration-based test runner** — in `tests/backend/conftest.py`, replace `Base.metadata.create_all()` + inline DDL with replaying `db/migrations/*.sql` into the per-run test schema. Approach: create schema → `SET search_path TO <test_schema>` on the connection → execute each migration file in order (reuse the read-order logic from `scripts/init_db.py`; skip the `schema_migrations` bookkeeping or scope it into the schema). Gotcha: any migration that hardcodes `public.` will need qualifying — fix the migration reference, don't special-case the runner. This kills the trigger/CHECK/index drift permanently.
4. **Frontend regression tests for BUG-2026-07-09-001/002/003** — three vitest tests: ProtectedRoute renders (not loops) for an `it_admin` on a role-guarded page; the activity-rail placeholder is plain ASCII; the exceptions page unwraps `{items, total}`. If any is untestable at reasonable cost, amend the gate wording in TESTING.md §9 instead — but the gate and the bug log must agree by sprint end.

**Done when:** all four closed (or re-scoped with a "slipped" note), local + CI green, CI run URL in the B-gate checklist.

---

## Phase 6.1 — UAT-1 Burn-Down

**Goal:** every P0/P1 from the owner's Sprint 1–5 UAT is fixed with a named regression test; P2s are triaged into the tech-debt table or Sprint 7+.

Process (repeat per finding):
1. Owner logs finding in BUILD_HISTORY.md Bug Log (`BUG-YYYY-MM-DD-NNN`, severity, repro steps).
2. Implementer reproduces, fixes, writes the named regression test (backend pytest or frontend vitest — same file-naming convention as existing bug tests).
3. Entry updated with root cause + fix + test path, mirroring the BUG-001…006 format.

Scope rule: this phase is **reactive** — do not pre-allocate tasks. If UAT-1 comes back clean, the phase closes trivially and the sprint pulls Phase 6.2 forward.

**Done when:** zero open P0/P1 UAT findings; every fix has a named test; P2s have a written destination.

---

## Phase 6.2 — Workspace Data Gaps

**Goal:** close the three long-standing P3 items that block the URLA work in Sprint 8 from having a home.

| Task | File(s) | Notes |
|---|---|---|
| `GET /api/v1/loans/{id}` detail endpoint | `api/v1/loans.py`, `services/loan_repo.py`, `schemas/loan_schema.py` | Single-loan fetch joining `loan_financials` + `loan_terms` + primary borrower + property. Kills the `getLoanById` → pipeline-with-`limit=1000` hack (tech-debt item). Use `get_db`; return `LoanDetailOut`. |
| Frontend switches to detail endpoint | `src/services/loanService.ts`, `src/hooks/useLoan.ts` | React Query hook fetches `/loans/{id}`; delete the pipeline-scan fallback. |
| Borrower panel in WorkspaceHome | `components/loans/workspace/WorkspaceHome.tsx` (+ small `BorrowerPanel` component) | Primary + co-borrowers from the `borrowers` table: name, contact, citizenship, credit-score band. Read-only this sprint — editing arrives with URLA (Sprint 8). |
| Property panel in WorkspaceHome | same area | Address, property type, occupancy, appraised value from `properties` / `property_details` (migration 113). Read-only. |

**Done when:** WorkspaceHome renders real borrower + property data via `GET /loans/{id}`, with vitest smoke tests for both panels.

---

## B-Gate Tests (Sprint 6)

- [ ] `tests/backend/test_rbac_coverage.py` — role × route matrix enforced
- [ ] Intake lifecycle test un-skipped and passing
- [ ] Full suite green against migration-built test schema (trigger/audit tests prove triggers now exist in tests)
- [ ] Named regression tests for BUG-001/002/003 (or amended gate)
- [ ] `tests/backend/test_loan_detail.py` — `GET /loans/{id}` returns financials/terms/borrower/property; 404 cross-tenant
- [ ] Vitest: BorrowerPanel + PropertyPanel render with data and with empty states
- [ ] One regression test per UAT-1 P0/P1 finding
- [ ] Green CI run URL: _(paste at close)_

## Out of scope (resist the temptation)

- Any URLA fields/editing (Sprint 8) · S3 (Sprint 7) · new workspace sections · analytics changes.
