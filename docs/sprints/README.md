# Sprint Index

All sprints for Origina LOS. Each sprint has a goal, a set of phases, and a definition of done.

> **Active sprint details:** [../CURRENT_SPRINT.md](../CURRENT_SPRINT.md)
> **Full milestone backlog:** [../ROADMAP.md](../ROADMAP.md)

---

## How Sprints Work

- A **sprint** is a named milestone with a clear goal. Usually 3–5 sessions.
- A **phase** is one focused session of work inside a sprint. Each phase has one deliverable.
- **During a sprint:** update `CURRENT_SPRINT.md` at the start of each session.
- **After a sprint completes:** archive `CURRENT_SPRINT.md` to this directory, update the index below, write a new `CURRENT_SPRINT.md` for the next sprint.

### Archive steps (when a sprint is done)
1. Write a completion summary at the bottom of `CURRENT_SPRINT.md` (what shipped, what slipped, lessons learned)
2. Copy `CURRENT_SPRINT.md` → `docs/sprints/sprint-N-name.md`
3. Update the index table below with completion date and archive link
4. Move completed ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. **Update `CLAUDE.md`** — sprint status in "What to build next", technical debt table, and any conventions the sprint changed (a stale CLAUDE.md misleads every future agent session)
6. Update `docs/architecture/` files the sprint touched (migration sequence in `database.md`, new ADRs in `DECISIONS.md`, etc.)
7. Write a fresh `CURRENT_SPRINT.md` for the next sprint

---

## Sprint Index

| # | Sprint | Goal | Status | Sessions | Completed |
|---|---|---|---|---|---|
| 1 | [Demo Unblocked](sprint-1-demo-unblocked.md) | First external demo is possible | ✅ **Complete** | 1–4 | 2026-07-07 |
| 2 | [Core Workflow](#sprint-2--core-workflow) | Multiple real users, conditions managed | **Active** | 5–7 | — |
| 3 | [Full Workspace](#sprint-3--full-workspace) | Every workspace section functional | Planned | 8–12 | — |
| 4 | [Manager Layer](#sprint-4--manager-layer) | Team visibility, notifications, assignments | Planned | 13–16 | — |
| 5 | [Production Hardening](#sprint-5--production-hardening) | Real lender can pilot it | Planned | 17–19 | — |

---

## Sprint 1 — Demo Unblocked

**Goal:** Put a laptop in front of someone and run a demo without it breaking.

**Done when:** You can log in, browse a paginated pipeline, submit a loan, open it and see real financial data — and the B-gate tests are green.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 1.1 | Security Config | JWT secret from env, CORS locked to localhost | ✅ Complete |
| 1.2 | Pagination | Pipeline paginated, page controls, envelope type | ✅ Complete |
| 1.3 | Loan Submission Integrity | Atomic 3-table insert, JOIN for borrower + amount | ✅ Complete |
| 1.4 | WorkspaceHome Real Data + Tests | `useLoanDetail` wires financials/terms, all 6 B-gate tests green | ✅ Complete |

**Archive:** [sprint-1-demo-unblocked.md](sprint-1-demo-unblocked.md) — closed 2026-07-07.

---

## Sprint 2 — Core Workflow

**Goal:** Multiple real users with different roles can use the platform.

**Done when:** A broker and an underwriter can each log in with their own accounts, access the right pages, and the underwriter can manage conditions on a loan.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 2.1 | Real Users + RBAC from DB | `POST /api/v1/users/`, role vocabulary reconciled (backend names canonical), one seed user per role | Planned |
| 2.2 | Condition Lifecycle Service | `condition_lifecycle.py` extracted, state machine tests at ≥90% coverage | Planned |
| 2.3 | Conditions Workspace UI | `WorkspaceConditions.tsx` — list, clear/waive/reject, add form, template picker | Planned |
| 2.4 | Pagination Envelope Pass | All remaining list endpoints return `PaginatedResponse[T]` — no bare lists | Planned |

**Build spec:** [sprint-2-build-spec.md](sprint-2-build-spec.md)
**Archive:** *(link added when sprint completes)*

---

## Sprint 3 — Full Workspace

**Goal:** Every workspace section does real work — nothing is a placeholder.

**Done when:** A full loan review cycle is possible inside the workspace — notes posted, status transitions with reasons, underwriter issues a decision, documents uploaded and linked to conditions.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 3.1 | Notes + Audit Log | `WorkspaceConversation.tsx` reads/writes `notes` table; `WorkspaceAuditLog.tsx` reads `audit_log` | Planned |
| 3.2 | Status Transition UI | Topbar status pill becomes a dropdown; status change writes to `loan_status_events` | Planned |
| 3.3 | Underwriting + Decision Panel | Decision panel, exceptions surfaced in UW section | Planned |
| 3.4 | Documents Section | Real upload with DB tracking, categorization, link to conditions | Planned |

**Build spec:** [sprint-3-build-spec.md](sprint-3-build-spec.md)
**Archive:** *(link added when sprint completes)*

---

## Sprint 4 — Manager Layer

**Goal:** A manager can see team health without opening individual loan files.

**Done when:** Analytics dashboard is date-filtered, pipeline shows assignments, a manager gets emailed when a loan is submitted.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 4.1 | Pipeline Assignments | `LoanSummary` includes AE/processor/underwriter; pipeline filter by person | Planned |
| 4.2 | Date Range Filters | Analytics charts respect date range; `AnalyticsFilterBar` wired to backend | Planned |
| 4.3 | Manager Dashboard | Team KPIs: loans by AE, processing time, approval rate by program | Planned |
| 4.4 | Domain Events + Notifications | `domain_events` outbox table + dispatcher (see ADR); email is the first consumer — webhooks/AI/SLA subscribe later | Planned |

**Build spec:** [sprint-4-build-spec.md](sprint-4-build-spec.md)
**Archive:** *(link added when sprint completes)*

---

## Sprint 5 — Production Hardening

**Goal:** A real lender can pilot this.

**Done when:** Auth is httpOnly cookie, CI is running on every PR, a new tenant can be onboarded from scratch.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 5.1 | Auth Security | httpOnly cookie JWT, rate limiting on `/auth/login` | Planned |
| 5.2 | Test Coverage + CI | Backend ≥70%, condition lifecycle ≥90%, every workspace section has smoke test, GitHub Actions on every PR | Planned |
| 5.3 | Multi-Tenant Onboarding | Admin creates tenant, bootstraps org config, onboards first user | Planned |

**Build spec:** [sprint-5-build-spec.md](sprint-5-build-spec.md)
**Archive:** *(link added when sprint completes)*
