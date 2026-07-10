# Current Sprint — Sprint 4: Manager Layer

> **Sprint index:** [docs/sprints/README.md](README.md)
> **Previous sprint:** [Sprint 3 — Full Workspace (archived)](sprint-3-full-workspace.md)
> **Full backlog:** [../ROADMAP.md](../ROADMAP.md) | **Session log:** [../BUILD_HISTORY.md](../BUILD_HISTORY.md)
> **Detailed build spec:** [sprint-4-build-spec.md](sprint-4-build-spec.md) ← read this before coding
>
> **Update this at the start of every session** — mark the active phase, note the session goal, update status.

---

## Sprint Goal

A manager can see team health without opening individual loan files. Analytics is date-filtered and live. Loan officers get emailed when a loan is submitted.

**Sprint is done when:**
- The pipeline table shows the assigned owner for each loan and can be filtered by assignee
- Analytics charts actually react to the date range + filter bar (real API call, not mock)
- The account manager dashboard renders team KPI tiles with live data
- Status transitions emit `domain_events` rows in the same transaction as the state change; an event dispatcher fans them out to email (when SMTP is configured) without blocking the request
- All Sprint 1–3 B-gate tests stay green; Sprint 4 B-gate tests are green

---

## Phases

### Phase 4.1 — Pipeline Assignments
**Status:** ✅ Complete
**Spec:** [sprint-4-build-spec.md §4.1](sprint-4-build-spec.md#phase-41--pipeline-assignments)

| Task | File(s) | Notes |
|---|---|---|
| Add `assigned_to` + `assigned_to_name` to `LoanPipelineSummaryOut` | `src/backend/app/schema/loan_schema.py` | Mirrors the frontend `LoanSummary.owner` field |
| Add `assigned_user` JOIN to `_PIPELINE_SQL` + `_PIPELINE_COUNT_SQL` | `src/backend/app/api/v1/loans.py` | LEFT JOIN `users` on `assigned_to`/`tenant_id`; selected as `assigned_to_name` |
| Parameterize pipeline WHERE for `assigned_to` + status filters | `src/backend/app/api/v1/loans.py` | `(:assigned_to IS NULL OR l.assigned_to = :assigned_to)`; same WHERE on the count query so filter/pagination stay consistent |
| Add `assigned_to` + `status_filter` query params to `GET /loans/pipeline` | `src/backend/app/api/v1/loans.py` | Public param is `status_filter` — the alias `status` collides with the SQL `l.status` reference in the same statement |
| Mirror new fields in `LoanPipelineSummaryOut` (frontend) | `src/frontend/src/types/api.ts` | `assigned_to: string \| null; assigned_to_name: string \| null` |
| Populate `owner` from `assigned_to_name` in `toSummary` | `src/frontend/src/services/loanService.ts` | `owner: row.assigned_to_name ?? "—"` (em-dash for unassigned) |
| Extend `listLoans` to accept `assignedTo` + `status` options | `src/frontend/src/services/loanService.ts` | Passes through to query string |
| Write `tests/backend/test_pipeline_filters.py` | `tests/backend/test_pipeline_filters.py` | 3 tests — assigned_to field surfaces, filter by status, filter by assignee |

**Phase done when:** Pipeline returns the assigned user's full name; `?assigned_to=<uuid>` and `?status_filter=<status>` return the right subset; all 3 new tests pass.

---

### Phase 4.2 — Analytics Filters (bug fixes)
**Status:** ✅ Complete
**Spec:** [sprint-4-build-spec.md §4.2](sprint-4-build-spec.md#phase-42--analytics-wired-to-backend)

No new endpoints — analytics was already wired in Sprint 1. Sprint 4.2 fixed two real bugs that crashed `?date_preset=...` calls once a manager tried them in the dashboard.

| Task | File(s) | Notes |
|---|---|---|
| Qualify date-range columns with `l.` | `src/backend/app/core/analytics_filters.py` | Was bare `created_at`/`updated_at` in the action-needed chart SQL — ambiguous once JOINs introduced other tables with the same columns (e.g., `borrowers.submitted_at`). All chart SQLs now use `l.<col>`. |
| Switch `IN (...)` / `NOT IN (...)` to `= ANY(:param)` / `<> ALL(:param)` | `src/backend/app/core/analytics_filters.py` | `IN (:list)` requires expanding the placeholder N times in `text()`; psycopg raises on `varchar` columns bound to `text[]`. `= ANY()` takes a single array parameter and works for both text and varchar. |
| Accept `list[str]` for `text`-typed filters in validation | `src/backend/app/core/analytics_filters.py` | The validator only handled `str`; multi-value `IN`/`NOT IN` were rejected before reaching SQL. Now it accepts both scalars and lists, matching what the frontend sends. |
| Write `tests/backend/test_analytics_summary.py` | `tests/backend/test_analytics_summary.py` | 5 tests — base shape, date preset, status filter, multi-status IN, loan-program filter |

**Phase done when:** `?date_preset=last_30_days` no longer raises 500; multi-value `IN`/`NOT IN` filters round-trip through the API. All 5 new tests pass.

---

### Phase 4.3 — Manager Dashboard
**Status:** ✅ Complete
**Spec:** [sprint-4-build-spec.md §4.3](sprint-4-build-spec.md#phase-43--manager-dashboard)

| Task | File(s) | Notes |
|---|---|---|
| Create `TeamKPICard` | `src/frontend/src/components/dashboard/manager/TeamKPICard.tsx` | One KPI tile; tone variant (success/warning/danger/info/neutral) colors the border; passes through `onClick` for future drilldown routing |
| Create `ManagerDashboardContent` | `src/frontend/src/components/dashboard/manager/ManagerDashboardContent.tsx` | Owns data fetching + KPI grid; renders a date-preset selector and `useAnalyticsSummary` grid; loading/error/empty states |
| Add `children` slot to `RoleDashboard` | `src/frontend/src/components/dashboard/RoleDashboard.tsx` | Lets role-specific pages compose their own content under the standard shell |
| Create `/dashboard/manager` page | `src/frontend/src/pages/dashboard/manager.tsx` | Wraps `RoleDashboard` with `ManagerDashboardContent` |
| Add `@tanstack/react-query` alias for tests | `src/frontend/vitest.config.ts` | The test suite mocks `useAnalyticsSummary`, but the path alias needs to resolve so the mock doesn't crash the import |
| Write `tests/frontend/ManagerDashboard.test.tsx` | `tests/frontend/ManagerDashboard.test.tsx` | 4 tests — renders KPI tiles from summary data, preset selector present, loading state, error state |

**Phase done when:** Logging in as an account manager lands on `/dashboard/manager` and shows live KPI tiles backed by `GET /analytics/summary`. Switching the date preset re-fires the request and updates the tiles. All 4 new tests pass.

**Spec deviation:** the build spec called for separate `LoansByProgramChart.tsx` + `TeamPipelineTable.tsx` components. Sprint 4 shipped a single `TeamKPICard` tile grid driven by the analytics summary's `kpis[]` array. The chart + per-AE pipeline table are deferred — manager dashboards get richer once Sprint 5 hardening lands.

---

### Phase 4.4 — Domain Events + Notifications
**Status:** ✅ Complete
**Spec:** [sprint-4-build-spec.md §4.4](sprint-4-build-spec.md#phase-44--domain-events--notifications)

| Task | File(s) | Notes |
|---|---|---|
| Migration `131_domain_events.sql` | `db/migrations/131_domain_events.sql` | New `domain_events` table (outbox), partial index on unprocessed rows, lookup index on `(tenant_id, entity_type, entity_id)`. Event-type whitelist is a `CHECK` constraint — widen it in a new migration to add types. |
| `DomainEvent` model + `EventType` constants | `src/backend/app/models/events.py` | Inherits `AppendOnlyModel` (id/tenant_id/created_at); adds `occurred_at` + nullable `processed_at` |
| Register `DomainEvent` + `EventType` in model export | `src/backend/app/models/__init__.py` | Required for SQLAlchemy metadata discovery |
| `emit_event()` + `dispatch_pending_events()` + `run_dispatch_in_background()` | `src/backend/app/services/event_service.py` | `emit_event` writes in the caller's session — same transaction as the state change. Dispatcher reads unprocessed, routes via `notification_consumer.handle`, stamps `processed_at`. |
| `notification_consumer.handle()` | `src/backend/app/services/notification_consumer.py` | Routes `loan.submitted` → assignee; `loan.status_changed` → `conditions_review` → all underwriters in tenant. Only place that knows notifications exist. |
| `notification_service.send_email()` | `src/backend/app/services/notification_service.py` | Minimal SMTP sender; returns `False` (no-op) when `SMTP_HOST` is empty so tests run without a mail server. |
| SMTP config | `src/backend/app/core/config.py` | `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` + `NOTIFICATIONS_ENABLED = bool(SMTP_HOST)` |
| Wire `emit_event` into `transition_status` | `src/backend/app/api/v1/status.py` | Emits `loan.submitted` (first transition into submitted) or `loan.status_changed` (every other transition) in the same transaction as the `loan_status_events` insert |
| Wire `emit_event` into `submit_loan` | `src/backend/app/api/v1/loans.py` | Emits `loan.submitted` when the submission flow is used directly |
| Fire dispatcher via `BackgroundTasks` | `src/backend/app/api/v1/status.py` | After commit, `_dispatch_in_background()` opens its own session and runs the dispatcher — keeps request latency unaffected |
| Startup dispatch hook | `src/backend/app/core/main.py` | Calls `run_dispatch_in_background()` once on startup; wrapped in try/except so a brief DB blip doesn't block boot |
| Write `tests/backend/test_domain_events.py` | `tests/backend/test_domain_events.py` | 5 tests — event row written on transition, dispatcher stamps `processed_at`, send_email no-op without SMTP, transition succeeds even when consumer raises, dispatcher survives consumer failure |

**Phase done when:** `POST /loans/{id}/status/transition` writes a row to `domain_events` in the same transaction; the dispatcher processes it post-commit; a failing consumer never aborts the transition or blocks the queue; SMTP is disabled by default so tests pass without a mail server. All 5 new tests pass.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 4.1 — Pipeline Assignments | ✅ Complete | this session |
| 4.2 — Analytics Filters (bug fixes) | ✅ Complete | this session |
| 4.3 — Manager Dashboard | ✅ Complete | this session |
| 4.4 — Domain Events + Notifications | ✅ Complete | this session |

---

## B-Gate Tests Checklist

Sprint 1–3 tests must remain green (regression). Sprint 4 adds:

- [x] `tests/backend/test_auth_secret_from_env.py` (Sprint 1, 4 tests)
- [x] `tests/backend/test_cors.py` (Sprint 1, 2 tests)
- [x] `tests/backend/test_pagination_envelope.py` (Sprint 1 + 2.4)
- [x] `tests/backend/test_loan_submission_e2e.py` (Sprint 1 — 2 pass / 1 skip)
- [x] `tests/backend/test_loan_financials_endpoint.py` (Sprint 1 — 3 pass / 1 skip)
- [x] `tests/backend/test_user_rbac.py` (Sprint 2.1, 5 tests)
- [x] `tests/backend/test_condition_lifecycle.py` (Sprint 2.2, 9 tests)
- [x] `tests/backend/test_notes_and_audit.py` (Sprint 3.1, 3 tests)
- [x] `tests/backend/test_status_transitions.py` (Sprint 3.2, 4 tests)
- [x] `tests/backend/test_documents.py` (Sprint 3.4, 3 tests)
- [x] `tests/backend/test_pipeline_filters.py` (Sprint 4.1, 3 tests) — **NEW**
- [x] `tests/backend/test_analytics_summary.py` (Sprint 4.2, 5 tests) — **NEW**
- [x] `tests/backend/test_domain_events.py` (Sprint 4.4, 5 tests) — **NEW**
- [x] `tests/frontend/ManagerDashboard.test.tsx` (Sprint 4.3, 4 tests) — **NEW**

**Final result:** 59 backend tests + 10 frontend tests, all green (2 backend skips remain: multi-tenant seed).

---

## After This Sprint Completes

1. Write a completion summary below (what shipped, what slipped, lessons learned)
2. Copy this file → `docs/sprints/sprint-4-manager-layer.md`
3. Update `docs/sprints/README.md` — mark Sprint 4 complete, add archive link + completion date
4. Move Sprint 4 ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Update `AGENTS.MD` / `CLAUDE.md` — Sprint 5 becomes next, technical debt table updated
6. Write a fresh `CURRENT_SPRINT.md` for Sprint 5 — Production Hardening

---

## Completion Summary

**Completed:** All four phases (4.1, 4.2, 4.3, 4.4). 13 new backend tests, 1 new frontend test file (4 tests), pipeline + analytics filter + domain events + manager dashboard all wired and live. SMTP is disabled by default so the test suite runs without a mail server.

**Slipped to Sprint 5+:** Per-AE pipeline table + LoansByProgram chart on the manager dashboard. The build spec called for separate components; Sprint 4 shipped a single `TeamKPICard` tile grid driven by `useAnalyticsSummary`'s `kpis[]` array instead. Defer the deeper breakdown until Sprint 5's auth/CI stabilization is done.

**Lessons learned:**
- **Date-column ambiguity from JOINs:** `_chart_action_needed` (and any other analytics SQL that JOINed extra tables) crashed on `?date_preset=...` because the date range filter used bare `created_at`/`updated_at` instead of `l.<col>`. The bug only surfaced once we wired the dashboard — `useAnalyticsSummary` made the call path real. Rule: qualify every column with its table alias in analytics SQL. The pre-Sprint-4 SQL had been correct only because the chart SQL happened to JOIN nothing.
- **`IN (:list)` does not bind array parameters against `varchar` columns.** The classic SQLAlchemy `text()` gotcha — `IN` expects expanded placeholders or `expanding=True`. `= ANY(:param)` is the right answer: one parameter, one binding, works for text and varchar. The validation layer also rejected `list[str]` for `text`-typed filters, masking the SQL bug with a 422. Both layers needed to be fixed together.
- **Transactional outbox pays for itself on day one.** Writing the event row in the same transaction as the state change is the entire reason notifications work correctly today. If SMTP is misconfigured, the loan still transitions. If the dispatcher crashes, the next request's `BackgroundTasks` picks it up. If a consumer raises, the dispatcher logs and continues. This is what "at-least-once delivery" looks like in practice — no two-phase commit, no compensation logic.
- **`BackgroundTasks` vs Celery:** the dispatcher's synchronous-in-process execution is intentional. We don't have Redis or a worker pool yet; `BackgroundTasks` after the response commit gives us 90% of the value (zero request latency, isolation from the transaction) at 5% of the operational cost. Replace with Celery + Redis when volume justifies it — the dispatcher API stays the same.
- **One consumer, one place that knows notifications exist.** `notification_consumer.py` is the ONLY file that imports both `DomainEvent` and `notification_service.send_email`. The loan routes know nothing about email; the event service knows nothing about SMTP. This boundary is what makes webhooks/AI/SLA timers (Phase 4) a matter of adding another consumer file, not touching loan code.
- **`run_dispatch_in_background` in startup must be try/except-wrapped.** A DB that's briefly unavailable on boot must not prevent the app from starting. Same reason as `db_init.sh` being idempotent — fail soft, let the next request catch up.
