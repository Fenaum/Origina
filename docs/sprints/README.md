# Sprint Index

All sprints for Origina LOS. Each sprint has a goal, a set of phases, and a definition of done.

> **Active sprint details:** [../CURRENT_SPRINT.md](../CURRENT_SPRINT.md)
> **Full milestone backlog:** [../ROADMAP.md](../ROADMAP.md)
> **End-user test scripts:** [../END_USER_TEST_SCRIPTS.md](../END_USER_TEST_SCRIPTS.md)

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

> **Program view:** [MILESTONES.md](MILESTONES.md) — a milestone every 5 sprints, closed by owner UAT + gate review.

### Milestone 1 — Pilot-Ready ✅ (UAT-1 in progress)

| # | Sprint | Goal | Status | Sessions | Completed |
|---|---|---|---|---|---|
| 1 | [Demo Unblocked](sprint-1-demo-unblocked.md) | First external demo is possible | ✅ **Complete** | 1–4 | 2026-07-07 |
| 2 | [Core Workflow](sprint-2-core-workflow.md) | Multiple real users, conditions managed | ✅ **Complete** | 5–7 | 2026-07-09 |
| 3 | [Full Workspace](sprint-3-full-workspace.md) | Every workspace section functional | ✅ **Complete** | 8 | 2026-07-09 |
| 4 | [Manager Layer](sprint-4-manager-layer.md) | Team visibility, notifications, assignments | ✅ **Complete** | 9 | 2026-07-09 |
| 5 | [Production Hardening](sprint-5-production-hardening.md) | Real lender can pilot it | ✅ **Complete** | 10–12 | 2026-07-10 |

### Milestone 2 — Operational Depth (start-to-fund without leaving Origina)

| # | Sprint | Goal | Status | Spec |
|---|---|---|---|---|
| 6 | Closeout & UAT Response ([active](../CURRENT_SPRINT.md)) | Audit debts + UAT-1 burn-down + workspace data gaps | 🔄 **In progress** | [spec](sprint-6-build-spec.md) |
| 7 | Document Platform v1 | S3 storage, doc→condition auto-linking, versioning | 📋 Planned | [spec](sprint-7-build-spec.md) |
| 8 | URLA (1003) Foundation | Full application data model + section editor | 📋 Planned | [spec](sprint-8-build-spec.md) |
| 9 | Processing & Funding | Milestone checklist, third-party panels, funding worksheet | 📋 Planned | [spec](sprint-9-build-spec.md) |
| 10 | Decisioning + **M2 Gate** | Decision objects, condition auto-gen, UAT-2 | 📋 Planned | [spec](sprint-10-build-spec.md) |

### Milestone 3 — Enterprise-Ready (multi-lender confidence) — DRAFT specs

| # | Sprint | Goal | Status | Spec |
|---|---|---|---|---|
| 11 | Org Hierarchy & Custom Roles | Branches/teams, scoped visibility, permission bundles | 📝 Draft | [spec](sprint-11-build-spec.md) |
| 12 | SLA Engine & Notifications | SLA timers on outbox, escalation, in-app SSE center | 📝 Draft | [spec](sprint-12-build-spec.md) |
| 13 | SSO & Security Round 2 | OIDC, lockout/session policy, secrets + headers | 📝 Draft | [spec](sprint-13-build-spec.md) |
| 14 | Audit, Retention & SOC 2 | Audit export, partitioning, control matrix | 📝 Draft | [spec](sprint-14-build-spec.md) |
| 15 | API Preview + **M3 Gate** | API keys, read-only external API, first webhook, UAT-3 | 📝 Draft | [spec](sprint-15-build-spec.md) |

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
| 2.1 | Real Users + RBAC from DB | `POST /api/v1/users/`, role vocabulary reconciled (backend names canonical), one seed user per role | ✅ Complete |
| 2.2 | Condition Lifecycle Service | `condition_lifecycle.py` extracted, state machine tests at ≥90% coverage | ✅ Complete |
| 2.3 | Conditions Workspace UI | `WorkspaceConditions.tsx` — list, clear/waive/reject, add form, template picker | ✅ Complete |
| 2.4 | Pagination Envelope Pass | All remaining list endpoints return `PaginatedResponse[T]` — no bare lists | ✅ Complete |

**Build spec:** [sprint-2-build-spec.md](sprint-2-build-spec.md)
**Archive:** [sprint-2-core-workflow.md](sprint-2-core-workflow.md) — closed 2026-07-09.

---

## Sprint 3 — Full Workspace

**Goal:** Every workspace section does real work — nothing is a placeholder.

**Done when:** A full loan review cycle is possible inside the workspace — notes posted, status transitions with reasons, underwriter issues a decision, documents uploaded and linked to conditions.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 3.1 | Notes + Audit Log | `WorkspaceConversation.tsx` reads/writes `notes` table; `WorkspaceAuditLog.tsx` reads `audit_log` | ✅ Complete |
| 3.2 | Status Transition UI | Topbar status pill becomes a dropdown; status change writes to `loan_status_events` | ✅ Complete |
| 3.3 | Underwriting + Decision Panel | Decision panel, exceptions surfaced in UW section | ✅ Complete |
| 3.4 | Documents Section | Real upload with DB tracking, categorization, link to conditions | ✅ Complete |

**Build spec:** [sprint-3-build-spec.md](sprint-3-build-spec.md)
**Archive:** [sprint-3-full-workspace.md](sprint-3-full-workspace.md) — closed 2026-07-09.

---

## Sprint 4 — Manager Layer

**Goal:** A manager can see team health without opening individual loan files.

**Done when:** Analytics dashboard is date-filtered, pipeline shows assignments, a manager gets emailed when a loan is submitted.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 4.1 | Pipeline Assignments | `LoanSummary` includes AE/processor/underwriter; pipeline filter by person | ✅ Complete |
| 4.2 | Date Range Filters | Analytics charts respect date range; `AnalyticsFilterBar` wired to backend (with bug fixes) | ✅ Complete |
| 4.3 | Manager Dashboard | Team KPI tiles driven by `useAnalyticsSummary`; account-manager-only page at `/dashboard/manager` | ✅ Complete |
| 4.4 | Domain Events + Notifications | `domain_events` outbox + dispatcher; `notification_consumer` (email is first consumer) | ✅ Complete |

**Build spec:** [sprint-4-build-spec.md](sprint-4-build-spec.md)
**Archive:** [sprint-4-manager-layer.md](sprint-4-manager-layer.md) — closed 2026-07-09.

---

## Sprint 5 — Production Hardening

**Goal:** A real lender can pilot this.

**Done when:** Auth is httpOnly cookie, CI is running on every PR, a new tenant can be onboarded from scratch.

| Phase | Name | Deliverable | Status |
|---|---|---|---|
| 5.0 | Lint Cleanup | `npm run lint` → 0 problems | ✅ Complete |
| 5.1 | Auth Security | httpOnly cookie JWT, rate limiting on `/auth/login` | ✅ Complete |
| 5.2 | Test Coverage + CI | Backend ≥70%, condition lifecycle ≥90%, every workspace section has smoke test, GitHub Actions on every PR | ✅ Complete |
| 5.3 | Multi-Tenant Onboarding | Admin creates tenant, bootstraps org config, onboards first user | ✅ Complete |

**Build spec:** [sprint-5-build-spec.md](sprint-5-build-spec.md)
**Archive:** [sprint-5-production-hardening.md](sprint-5-production-hardening.md) — closed 2026-07-10.
