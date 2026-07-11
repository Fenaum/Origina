# Current Sprint — Sprint 6: Closeout & UAT Response

> **Sprint index:** [docs/sprints/README.md](sprints/README.md) | **Program plan:** [docs/sprints/MILESTONES.md](sprints/MILESTONES.md)
> **Previous sprint:** [Sprint 5 — Production Hardening (archived)](sprints/sprint-5-production-hardening.md)
> **Full backlog:** [ROADMAP.md](ROADMAP.md) | **Session log:** [BUILD_HISTORY.md](BUILD_HISTORY.md)
> **Detailed build spec:** [docs/sprints/sprint-6-build-spec.md](sprints/sprint-6-build-spec.md) ← read this before coding
>
> **Update this at the start of every session** — mark the active phase, note the session goal, update status.

---

## Sprint Goal

**Milestone 2 (Operational Depth), sprint 1 of 5.** Clear the Sprint 1–5 audit debts (Phase 6.0), burn down UAT-1 findings as they arrive (Phase 6.1), and close the workspace data gaps that Sprint 8's URLA work builds on (Phase 6.2). Full task detail in the [build spec](sprints/sprint-6-build-spec.md).

---

## Phases

### Phase 6.0 — Sprint 1–5 Closeout (carry-over from post-close audit)
**Status:** 🔄 Not started
**Est. effort:** ~1 session
**Spec:** [sprint-5-production-hardening.md — "What slipped"](sprints/sprint-5-production-hardening.md) (audit findings, 2026-07-10)

| Task | File(s) | Notes |
|---|---|---|
| RBAC route coverage matrix | `tests/backend/test_rbac_coverage.py` | Slipped from Sprint 5.2. Parameterize role × representative route (at least one read + one write per domain router); assert 200/403 per the `require_roles` declarations. Only `/users/` is covered today — authz regressions across ~167 routes are currently invisible. |
| Investigate skipped intake test | `tests/backend/test_coverage_gaps.py:1005` | Skip message is a real error: "intake lifecycle failed: Multiple rows were found when exactly one was required" — likely a `.one()` in the intake flow hitting duplicate rows. Diagnose, fix the bug (or the test seeding), un-skip. Log as a BUG entry in BUILD_HISTORY.md if it's a product bug. |
| Migration-based test runner | `tests/backend/conftest.py` | Slipped from Sprint 5.2 (second carry). Replace `create_all()` + inline DDL with replaying `db/migrations/*.sql` into the per-run test schema (via `search_path`). Eliminates schema drift between tests and production; new migrations become test-visible automatically. |
| Frontend regression tests for logged bugs | `tests/frontend/` | BUG-2026-07-09-001 (ProtectedRoute redirect loop), 002 (placeholder rendering), 003 (exceptions envelope unwrap) have manual-only coverage, violating the "every bug gets a named regression test" gate. Write the three vitest tests, or amend the gate in TESTING.md §9 to exempt pure-rendering bugs — either way, make the gate and the bug log agree. |

**Phase done when:** all four items closed (or explicitly re-scoped with a "slipped" note), suite green locally **and** in CI, and the CI run URL is linked below.

---

### Phase 6.1 — UAT-1 Burn-Down
**Status:** ⏳ Waiting on UAT-1 findings (owner running UAT of Sprints 1–5)
**Spec:** [sprint-6-build-spec.md §6.1](sprints/sprint-6-build-spec.md) — reactive phase: every P0/P1 finding gets a fix + named regression test; P2s get a written destination.

### Phase 6.2 — Workspace Data Gaps
**Status:** 🔄 Not started
**Spec:** [sprint-6-build-spec.md §6.2](sprints/sprint-6-build-spec.md) — `GET /loans/{id}` detail endpoint (kills the `limit=1000` hack), frontend switch, read-only Borrower + Property panels in WorkspaceHome.

---

## Process rules adopted this sprint (from the Sprint 1–5 audit)

1. **CI is the source of truth for test results.** The B-gate checklist records test *file names and what they prove* — not hand-copied counts. Completion summaries link the green CI run URL instead of transcribing numbers.
2. **No silent slippage.** A phase may close with unfinished tasks only if the completion note lists them under "slipped" with a destination (next sprint / tech-debt table).
3. **Commit and push at phase boundaries.** Sprints 3–5 sat uncommitted on one branch for days — CI never ran and the work had no off-machine copy. One phase, at least one pushed commit.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 6.0 — Sprint 1–5 Closeout | 🔄 Not started | — |
| 6.1 — UAT-1 Burn-Down | ⏳ Waiting on findings | — |
| 6.2 — Workspace Data Gaps | 🔄 Not started | — |

---

## B-Gate Tests Checklist

Sprint 1–5 B-gates must remain green (regression) — see the [Sprint 5 archive](sprints/sprint-5-production-hardening.md) for the full list. Sprint 6 adds:

- [ ] `tests/backend/test_rbac_coverage.py` — proves every role sees exactly the routes its `require_roles` declarations allow
- [ ] `tests/backend/test_coverage_gaps.py` intake lifecycle test un-skipped and passing — proves the intake flow survives the duplicate-rows condition
- [ ] Migration-built test schema — proves tests run against the same DDL as production (triggers, CHECKs, partial indexes included)
- [ ] Named regression tests (or amended gate) for BUG-2026-07-09-001/002/003
- [ ] Green CI run linked here: _(paste Actions run URL at phase close)_

---

## After This Sprint Completes

1. Write a completion summary at the bottom of this file (what shipped, **what slipped**, lessons learned)
2. Copy this file → `docs/sprints/sprint-6-<name>.md`
3. Update `docs/sprints/README.md` — mark Sprint 6 complete, add archive link + completion date
4. Move completed ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Update `CLAUDE.md` — sprint status, technical debt table (clear the rows Phase 6.0 resolves)
6. Write a fresh `CURRENT_SPRINT.md` for Sprint 7
