# Origina LOS — Project Roadmap

> **Cross-links:** [PMO.md](PMO.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md) | [TESTING.md](TESTING.md)

## Current State (as of July 2026 — Session 34)

The platform has a working end-to-end demo path:
1. Borrower visits `/borrower/welcome` → completes intake → sees program recommendations → submits handoff
2. AE logs in at `/login` → sees pipeline of 202 real seeded loans paginated at 50/page → opens any loan file → workspace shows real LTV/CLTV/DTI/DSCR/FICO/rate-lock
3. AE views analytics at `/analytics` → KPIs, charts, volume trends with drilldown panels
4. AE manages exceptions at `/exceptions` → creates pre-file exceptions → attaches approved exceptions to loans
5. AE/admin accesses `/settings` (profile, security, notifications, preferences) and `/admin` (people, products, workflow)
6. AE submits a new loan from the wizard → it appears in the pipeline with the correct borrower name and amount

**Sprint 1 — Demo Unblocked — closed 2026-07-07** ([archive](sprints/sprint-1-demo-unblocked.md)). All 4 phases complete, all 6 B-gate test files green.
**Sprint 2 — Core Workflow — closed 2026-07-09** ([archive](sprints/sprint-2-core-workflow.md)). Real users + RBAC, condition lifecycle, conditions workspace, pagination envelope on remaining list endpoints.
**Sprint 3 — Full Workspace — closed 2026-07-09** ([archive](sprints/sprint-3-full-workspace.md)). Notes, audit log, status transitions, underwriting panels, documents all wired end-to-end.
**Sprint 4 — Manager Layer — closed 2026-07-09** ([archive](sprints/sprint-4-manager-layer.md)). Pipeline assignments + filters, analytics date-filter bug fixes, manager dashboard tiles, domain-events outbox + email notifications.
**Sprint 5 — Production Hardening — closed 2026-07-10** ([archive](sprints/sprint-5-production-hardening.md)). httpOnly cookie auth + rate limiting, GitHub Actions CI with coverage gates, multi-tenant onboarding via `POST /tenants/bootstrap` + admin UI.
**Next:** [Sprint 6 — TBD](CURRENT_SPRINT.md). Awaiting owner-authored sprint spec.

**What is real:** Auth (JWT with env-var secret), CORS locked to localhost, pipeline pagination (50/page with controls) + assignee filter + status filter, atomic 3-table loan submission with JOINed response, workspace financials via real API, full exception module (26 routes), controlled values architecture (18 sets, 144+ values), metadata API, task management, condition templates, marketing pages (guideline, product, about), notes/audit log/status-transition UI in workspace, documents upload + download + archive, account-manager team KPI dashboard, transactional outbox + SMTP email notifications (disabled when SMTP_HOST is empty), httpOnly cookie auth (`origina_token`, dual-mode cookie OR Bearer accepted) + slowapi rate limit on `/auth/login`, GitHub Actions CI on every PR with backend coverage gate (≥70%) + condition-lifecycle gate (≥90%), `POST /api/v1/tenants/bootstrap` (ADMIN_SECRET-guarded) for tenant + first admin creation in one atomic call, Settings → Admin → Tenant Onboarding UI.
**What is mock:** Document upload (file bytes are stored to local disk, not S3), pricing (hardcoded scenarios), MISMO parsing (stub), settings pages (UI built, no backend save), SMTP transport (sender is wired but no production mail relay yet — `localhost` smoke tests rely on `notification_service` no-op when `SMTP_HOST` is empty).
**Testing foundation:** 134 backend + 13 frontend tests passing, 2 backend skipped (exception + intake smoke checks pending seed). Backend coverage 70.30%; `app/services/condition_lifecycle.py` 90.00%. See **Testing Checkpoints** below.

---

## What We Did Well ✅

### Backend
- [x] Clean layered architecture — no business logic leaking into routes
- [x] Audited DB writes via `get_audited_db` dependency — every mutation is traceable
- [x] LATERAL JOIN pipeline query — no N+1, performant at scale
- [x] Raw SQL migrations with schema tracking — no Alembic conflicts
- [x] Satellite table pattern (`loan_financials`, `loan_terms`) — clean separation, 1:1 enforced at DB level
- [x] Event sourcing for loan status — full audit trail, compliant
- [x] Multi-tenancy baked in at query level — not bolted on
- [x] 202 realistic seeded Non-QM loans across 5 programs with realistic distributions
- [x] Anonymous intake sessions — no auth wall before borrower engagement
- [x] RBAC dependency factory — one line per route to enforce roles
- [x] Exception module (25 routes) — full lifecycle, structured UW fields, authority rules, decisions with conditions
- [x] Controlled values architecture — zero PostgreSQL ENUMs, TEXT+CHECK, 18 value sets, tenant override model
- [x] Metadata API (`GET /api/v1/metadata/values`) — frontend bootstrap endpoint for all controlled values
- [x] Pre-file exceptions — `loan_id` nullable, global `/exceptions` page, `link-loan` endpoint
- [x] httpOnly cookie auth — `origina_token` set by `/auth/login` (HttpOnly + SameSite=Lax + Path=/); `POST /auth/logout` clears it; `get_current_user` accepts cookie OR Bearer header for API clients (Sprint 5.1) — `tests/backend/test_auth_cookie.py`
- [x] Login rate limiting — slowapi per-IP limiter on `/auth/login` (default 10/min, configurable via `LOGIN_RATE_LIMIT`); in-process storage with autouse test fixture clearing state between tests (Sprint 5.1)
- [x] `POST /api/v1/tenants/bootstrap` — ADMIN_SECRET-guarded atomic create of tenant + first IT_ADMIN user + 5 canonical roles; returns `{tenant_id, user_id, email, role}` (Sprint 5.3) — `tests/backend/test_tenant_bootstrap.py`

### Frontend
- [x] Modular component architecture — each workspace section is independent
- [x] Zustand stores cleanly separated by concern (auth, pipeline, intake, recent loans, submission)
- [x] SSN security invariant enforced in code via `partialize` — can't accidentally persist it
- [x] Client-side filter/sort pipeline — instant feedback, zero round-trips
- [x] Built-in vs user-created views separation — code updates don't wipe user preferences
- [x] All state that should be ephemeral uses sessionStorage (intake) vs persistent (pipeline prefs)
- [x] Horizontal workspace navigation with `?section=` params — no 15-page route explosion
- [x] Accessibility baked in from the start (aria-*, focus-visible, heading hierarchy, role=menu)
- [x] CSS design system via variables — consistent colors, radii, spacing throughout
- [x] `:has()` selector for layout overrides — pipeline workspace goes full-bleed without a new layout component
- [x] Tasks workspace (`WorkspaceTasks`) — full CRUD + status cycle + template picker (Session 19)
- [x] Condition templates — `TemplatePickerModal` shared across tasks + conditions (Session 19)
- [x] Non-QM template library — 4 task templates + 4 condition templates in `data/templates.ts` (Session 19)
- [x] Borrower add/remove with type picker in URLA section (Session 19)
- [x] Submission data-loss bug fixes — saveDraft now syncs borrower/property/financials to DB (Session 20)
- [x] MISMO import — concurrent Promise.all race condition + applyImport external setState fixed (Session 21)
- [x] Settings module frontend — `/settings/*` and `/admin/*` pages with SettingsLayout (Session 25)
- [x] Marketing pages — `/guideline`, `/product`, `/about` (Session 26)
- [x] Role dashboards visual refresh — DashboardCard gradients, sparklines, monogram avatars, trend chips (Session 29)
- [x] Analytics dashboard visual refresh — MetricCard drilldown, DrilldownPanel, DrilldownTable, analytics.css rewrite (Session 29)
- [x] Pipeline assignments + filters — `LoanSummary.owner` from `users.full_name` JOIN; `?assigned_to=<uuid>` + `?status_filter=<status>` filter the pipeline (Sprint 4.1) — `tests/backend/test_pipeline_filters.py`
- [x] Analytics date-filter bug fixes — date columns qualified with `l.`, `IN(:list)` → `= ANY(:param)`, `text` filter validator accepts `list[str]` (Sprint 4.2) — `tests/backend/test_analytics_summary.py`
- [x] Manager dashboard tiles — `/dashboard/manager` page renders `TeamKPICard` grid driven by `useAnalyticsSummary`; date-preset selector re-fires the request (Sprint 4.3) — `tests/frontend/ManagerDashboard.test.tsx`
- [x] Domain events + notifications — `domain_events` outbox table (migration 131), `emit_event`/`dispatch_pending_events` services, `notification_consumer` routes to email when SMTP is configured (Sprint 4.4) — `tests/backend/test_domain_events.py`
- [x] `npm run lint` clean — 22 problems (9 errors, 13 warnings) inherited from Sprints 3-4 across 11 files reduced to 0; ESLint config now exempts `_`-prefixed unused vars (Sprint 5.0)
- [x] Tenant onboarding UI — Settings → Admin → TenantOnboardingCard sub-component; calls `POST /tenants/bootstrap` from the browser so a new lender can be spun up without the CLI (Sprint 5.3)
- [x] Cookie-aware apiClient — `credentials: "include"` on every fetch so the httpOnly cookie is sent cross-origin; auth state no longer stores the JWT in localStorage on the read path (Sprint 5.1)

### Testing Foundation
- [x] Backend pytest harness — `tests/backend/conftest.py` (schema-per-test-run isolation, ASGI client), `tests/backend/pytest.ini`, `tests/backend/test_health.py` (5 smoke tests green) — `tests/backend/test_health.py`
- [x] Frontend vitest harness — `src/frontend/vitest.config.ts`, `tests/frontend/setup.ts`, 2 smoke tests green — `tests/frontend/LoanPipelineTable.test.tsx`
- [x] Unified runner script — `scripts/run_tests.sh` (backend + frontend, exits non-zero on failure)
- [x] **Sprint 1 B-gate tests (all green, 2026-07-07):**
  - `tests/backend/test_auth_secret_from_env.py` (4 tests) — JWT env loading, default-rejected, rotation invalidates tokens
  - `tests/backend/test_cors.py` (2 tests) — localhost allowed, unknown origin blocked
  - `tests/backend/test_pagination_envelope.py` (3 tests) — envelope shape, `skip`/`limit` honored, `total` consistent
  - `tests/backend/test_loan_submission_e2e.py` (2 pass / 1 skip) — 3-row atomic insert, double-submit rejection, tenant isolation (skipped: multi-tenant seed pending)
  - `tests/backend/test_loan_financials_endpoint.py` (3 pass / 1 skip) — happy shape, 404, terms shape, tenant scoping (skipped: multi-tenant seed pending)
  - `tests/frontend/WorkspaceHome.test.tsx` (2 tests) — renders financial summary block
- [x] **Sprint 5 B-gate tests (all green, 2026-07-10):**
  - `tests/backend/test_auth_cookie.py` (7 tests) — cookie set on login, cleared on logout, dual-mode cookie OR Bearer, csrf-style cross-origin guard
  - `tests/backend/test_coverage_gaps.py` (52 tests / 2 skip) — borrowers, roles, metadata, loans, exceptions, tasks, audit, intake
  - `tests/backend/test_tenant_bootstrap.py` (6 tests) — happy path, wrong-secret 403, no-secret 503, duplicate name 409, role assignment
  - `tests/backend/test_intake_ranking.py` (4 tests) + `tests/backend/test_notification_service.py` (3 tests) — gap-fills
  - `tests/frontend/WorkspaceStatus.test.tsx` + `WorkspaceConversation.test.tsx` + `WorkspaceDocuments.test.tsx` — every workspace section now has smoke coverage
  - `npm run lint` reports **0 problems** (was 22) — Sprint 5.0 baseline

---

## Priority 1 — Demo-Blocking ✅ CLEARED 2026-07-07

**All P1 items are done.** The demo path works end-to-end. See [sprints/sprint-1-demo-unblocked.md](sprints/sprint-1-demo-unblocked.md) for the full closure record.

### Backend
- [x] **Pagination** — `GET /loans` + `GET /loans/pipeline` both return `PaginatedResponse[T]`; `skip`/`limit` honored; `total` matches DB count. Frontend `useLoans(page, pageSize)` + `PipelineGrid` prev/next controls. *(Deferred: other list endpoints — see Sprint 2 hardening item.)* — `tests/backend/test_pagination_envelope.py`
- [x] **CORS lockdown** — `allow_origins=ALLOWED_ORIGINS` from env, defaults to `["http://localhost:3000"]`. — `tests/backend/test_cors.py`
- [x] **JWT secret rotation** — `JWT_SECRET_KEY` loaded from env at startup; default `"change-me-in-production"` rejected when `APP_ENV != "local"`; rotation invalidates in-flight tokens. — `tests/backend/test_auth_secret_from_env.py`

### Frontend
- [x] **Loan submission to real API** — `POST /loans/` → `PUT /loans/{id}/financials` → `PUT /loans/{id}/terms` → `POST /loans/{id}/submit` are atomic via `get_audited_db`. `submit_loan` JOINs `borrowers` and `loan_financials` and returns `LoanSubmitOut(borrower_name, loan_amount, ...)`. Frontend `saveDraft` syncs to backend (Sessions 20–22). — `tests/backend/test_loan_submission_e2e.py`
- [x] **Real loan_financials + loan_terms in WorkspaceHome** — `useLoanDetail` hook fetches `/loans/{id}/financials` and `/loans/{id}/terms` in parallel with the rest of the detail. `WorkspaceHome` hero metrics render real LTV, CLTV, DTI, DSCR, FICO, lock status, interest rate. — `tests/backend/test_loan_financials_endpoint.py` + `tests/frontend/WorkspaceHome.test.tsx`

---

## Testing Checkpoints

> Every roadmap checklist item ships with its matching test file. A milestone is **not cleared** until every test listed below for that milestone is green. Tests live under `tests/backend/` and `tests/frontend/` (see [ARCHITECTURE.md](ARCHITECTURE.md) for conventions).
>
> 📖 **How-to / setup / troubleshooting → [TESTING.md](TESTING.md).** This section is the plan; TESTING.md is the operator's manual.

### A. Foundation ✅ COMPLETE

- [x] **A1. Backend `pytest` harness** — `tests/backend/conftest.py` (schema-per-test-run isolation via `SET search_path TO test_origina_<uuid>`, async ASGI client via httpx, seed stub), `tests/backend/pytest.ini` (`asyncio_mode=auto`), 5 smoke tests green → `tests/backend/test_health.py`
- [x] **A2. Frontend `vitest` harness** — `src/frontend/vitest.config.ts` (jsdom env, `@/*` alias, explicit node_modules aliases for jest-dom + react), `tests/frontend/setup.ts` (jest-dom matchers), 2 smoke tests green → `tests/frontend/LoanPipelineTable.test.tsx`
- [x] **A3. Unified runner** — `scripts/run_tests.sh` (backend + frontend, sources `.env`, exits non-zero on failure, prints PASS/FAIL summary)

### B. Priority 1 Gate Tests ✅ COMPLETE 2026-07-07

- [x] **Pagination envelope** → `tests/backend/test_pagination_envelope.py` (3 pass)
  - `GET /api/v1/loans/pipeline?skip=0&limit=50` returns `{"items": [...], "total": int}` with `len(items) <= 50`
  - `total` matches `SELECT COUNT(*) FROM loans` for the tenant
  - `skip` and `limit` are honored (offset semantics correct)
  - Frontend component test: `PipelineGrid` renders page controls and fires new requests on page change

- [x] **CORS lockdown** → `tests/backend/test_cors.py` (2 pass)
  - `OPTIONS` from disallowed origin returns **no** `Access-Control-Allow-Origin` header
  - `OPTIONS` from `http://localhost:3000` (dev whitelist) returns correct `Access-Control-Allow-Origin`
  - Credentials flag still respected

- [x] **JWT secret rotation** → `tests/backend/test_auth_secret_from_env.py` (4 pass)
  - Token issued at startup is signed with `os.environ['JWT_SECRET_KEY']`
  - Changing `JWT_SECRET_KEY` invalidates previously-issued tokens
  - Default `"change-me-in-production"` is rejected (raises on startup)
  - `APP_ENV=local` permits the default (locked regression test)

- [x] **Loan submission to real API** → `tests/backend/test_loan_submission_e2e.py` (2 pass / 1 skip)
  - Happy path: `POST /api/v1/loans/` with valid payload creates `loans` row + `loan_financials` row + `loan_terms` row atomically
  - Tenant scoping: a loan submitted as tenant A is invisible to tenant B queries (skipped: multi-tenant seed pending — Sprint 2 picks up)
  - Double-submit of a non-draft loan returns 422

- [x] **WorkspaceHome financials** → `tests/backend/test_loan_financials_endpoint.py` (3 pass / 1 skip) + `tests/frontend/WorkspaceHome.test.tsx` (2 pass)
  - `GET /api/v1/loans/{id}/financials` returns rate, term, amount fields
  - Component renders the financial summary block without errors when given a real loan payload

### C. Priority 2 Gate Tests (must be green to clear P2)

- [ ] **Real user creation** → `tests/backend/test_user_crud.py`
  - `POST /api/v1/users/` (admin) creates broker/underwriter/processor users with correct `tenant_id`
  - Non-admin token is rejected with 403
  - Duplicate email rejected with 409

- [ ] **Role field on user model** → `tests/backend/test_role_from_db.py`
  - `get_current_user` reads `users.role` column (no more email-prefix inference)
  - Authz tests parameterized over `["ae", "broker", "underwriter", "processor", "admin"]` — each role gets/denied correctly per route

- [ ] **Condition lifecycle (state machine)** → `tests/backend/test_condition_state_machine.py` ← **CRITICAL**
  - Valid transitions: `outstanding → submitted → cleared | waived | rejected`
  - Invalid transitions return 409 (e.g., `cleared → outstanding` not allowed)
  - `waive` and `reject` require non-empty `reason` field
  - All transitions write to `loan_status_events` (or condition audit table) — full history preserved
  - Coverage target: **≥ 90%** on `app/services/condition_lifecycle.py`

- [ ] **Conditions workspace UI** → `tests/frontend/ConditionsSection.test.tsx`
  - Lists conditions with correct status badges (green/orange/red)
  - Clear / Waive / Reject buttons open modal, submit, optimistically update UI
  - Empty state renders when no conditions exist

- [ ] **Pipeline pagination wired** → `tests/frontend/PipelinePagination.test.tsx`
  - Page controls change URL query params
  - New `GET /loans?skip=N&limit=50` request fires
  - No duplicate loans between page transitions

- [ ] **Real demo users** → `tests/backend/test_demo_user_seeds.py`
  - `bootstrap_user.py` script creates one user per role with the expected tenant
  - Login works for each role; sidebar items differ per role

### D. Coverage Gates for Priority 3 / Priority 4

- [ ] **Backend coverage gate** — `pytest --cov=app/api --cov-fail-under=70` in CI
- [ ] **Condition lifecycle coverage gate** — `--cov=app/services/condition_lifecycle --cov-fail-under=90` (state machines are the highest-risk surface)
- [ ] **Frontend smoke gate** — every workspace section (`Processing`, `Underwriting`, `Conditions`, `Documents`, `Notes`, `Audit Log`, `Borrower URLA`, `Lender URLA`, `HMDA`, `Loan Estimate/Closing`, `Closing`, `Funding`) has at least one render-without-crash test
- [ ] **Regression suite** — every bug recorded in [BUILD_HISTORY.md](BUILD_HISTORY.md) gets a named test case (e.g., `test_bug_2a_checklist_wipe_on_remount`) so it cannot silently return
- [ ] **CI run** — `scripts/run_tests.sh` is invoked on every PR; red builds block merge

### Definition of Done (applies to every roadmap checklist item)

An item can move from a Priority list to **"What We Did Well"** only when **all** of:
1. The feature itself is shipped
2. The test file(s) listed in this section exist and pass
3. The test file path is linked in the "What We Did Well" entry (so future readers can audit coverage)
4. No skipped/pending tests (`@pytest.mark.skip`, `it.todo`) reference that item

---

## Priority 2 — Core Workflow (within 4 weeks of demo)

### Backend
- [ ] **Real user creation** — only `admin@origina.dev` works today
  - API endpoint: `POST /api/v1/users/` (admin only)
  - Create broker, underwriter, processor users
  - Assign `tenant_id` correctly

- [ ] **Role field on user model** — currently derived from email prefix
  - Store role in DB, not inferred from email string
  - Fix `get_current_user` to read from `users.role` column

- [ ] **Condition management endpoints** — routes exist but need full CRUD + lifecycle
  - `PATCH /conditions/{id}/clear`
  - `PATCH /conditions/{id}/waive` (with reason)
  - `PATCH /conditions/{id}/reject` (with reason)

### Frontend
- [ ] **Conditions section in Loan Workspace** — currently a placeholder
  - List of conditions with status badges
  - Clear / Waive / Reject actions
  - Add new condition form

- [ ] **Pagination in pipeline grid** — wire `skip`/`limit` to backend
  - Add page controls or infinite scroll to `PipelineGrid`
  - Update `loanService.ts` to pass pagination params

- [ ] **Real users for demo walkthroughs**
  - Create broker user, underwriter user via admin panel or script
  - Verify role-based sidebar and pipeline access for each

---

## Priority 3 — Full Feature Completeness (milestone after initial demo)

### Backend
- [ ] Borrower-facing condition view endpoint
- [ ] Document storage (S3 integration — currently simulated)
- [x] Notification system (email on handoff, status change) — Sprint 4 (transactional outbox + SMTP, disabled when SMTP_HOST empty) — `tests/backend/test_domain_events.py`
- [x] Loan status transition validation (enforce state machine) — shipped in Sprint 2 (`status.py` ALLOWED_TRANSITIONS)
- [x] Exception module — 25 routes, full lifecycle, decisions, conditions, pre-file
- [x] Task management endpoints — full CRUD + status transitions
- [x] Notes/internal conversation endpoint — wired in Sprint 3 (`WorkspaceConversation.tsx` reads/writes `/notes/`)
- [ ] Full URLA (1003) data model and API

### Frontend
- [ ] Processing section — milestone checklist
- [x] Underwriting section — decision panel + exceptions + pricing/eligibility runs surfaced (Sprint 3)
- [x] Documents section — upload, categorize, link to conditions (Sprint 3)
- [x] Notes section — threaded internal conversation (Sprint 3)
- [x] Audit Log section — real `audit_log` table data (Sprint 3)
- [ ] Loan creation form (`/loans/new/manual`) — multi-step, currently placeholder
- [x] Status transition UI in workspace topbar (Sprint 3, in `WorkspaceStatus.tsx`)
- [ ] Borrower panel in workspace home (co-borrowers, contact info)
- [ ] Property panel (address, type, appraised value)
- [x] Analytics: date range filter — Sprint 4 (`AnalyticsFilterBar` wired to backend; date-column + `IN(:list)` + validator fixes) — `tests/backend/test_analytics_summary.py`
- [ ] Analytics: export to PDF/image
- [x] Pipeline: assignment columns — Sprint 4 (`LoanSummary.owner` from `users.full_name` JOIN) — `tests/backend/test_pipeline_filters.py`
- [ ] Pipeline: priority field (requires DB column + API field)
- [ ] Pipeline: bulk actions (select multiple rows)
- [ ] Right-side activity panel in pipeline (recent loan updates, status changes)
- [ ] React Query / SWR for data caching and background refetch

---

## Priority 4 — Manager & Reporting Layer (post-MVP)

- [x] Manager analytics dashboard (team KPIs, workload distribution charts) — Sprint 4 (KPI tile grid at `/dashboard/manager`; deeper per-AE breakdown deferred) — `tests/frontend/ManagerDashboard.test.tsx`
- [ ] Performance reporting (processing time, approval rates by product)
- [ ] Team KPI pivot tables
- [ ] Pipeline forecasting
- [ ] Funnel conversion rates (submitted → approved → funded)
- [ ] Custom user dashboards
- [ ] Real-time notifications (WebSocket or SSE)

---

## Long-Term Phase Roadmap

> From the July 2026 quarterly architecture review. Priorities 1–4 above cover Phases 1–2 in detail; this table is the horizon view. The platform/AI phases assume the "Domain Events via Transactional Outbox" and "AI Scope" ADRs in [DECISIONS.md](DECISIONS.md).

| Phase | Target | Objective | Major deliverables | Success metric |
|---|---|---|---|---|
| **1. Pilot-Ready** | Q3 2026 | One real lender runs loans end-to-end | Sprints 2–5 (RBAC, condition lifecycle, workspace wiring, domain events + notifications, httpOnly auth, CI, tenant onboarding) | Pilot lender onboarded; CI green on every PR; zero P0 bugs in a 2-week pilot window |
| **2. Operational Depth** | Q4 2026 | The workflows a lender lives in daily | URLA (1003) data model + editor; processing milestones; funding worksheet; decisioning as first-class object; S3 storage; document→condition auto-linking | Pilot lender processes a loan start-to-fund without leaving Origina |
| **3. Enterprise** | Q1 2027 | Multi-lender confidence | Org hierarchy (branches/teams); SLA engine (on domain events); custom roles; SSO (SAML/OIDC); audit retention/export; SOC 2 groundwork | 3+ tenants; SSO live; SOC 2 Type 1 scheduled |
| **4. Platform** | Q2 2027 | First external API consumer | API keys (machine auth); webhooks (on domain events); versioning policy + changelog; read-only Audit/Status API first; one CRM integration; generated TypeScript SDK | One partner integration in production; API uptime SLO met for a quarter |
| **5. Engines** | Q3 2027 | The differentiating IP | Guideline data model; eligibility rules engine (rules-as-data, tenant-customizable); pricing (build-vs-buy ADR first); condition auto-generation on submission | Eligibility engine agrees with manual UW determination ≥95% before any auto mode |
| **6. AI** | Q4 2027 | AI layer (per AI Scope ADR sequence) | Doc classification → data extraction with review UI → missing-doc detection → loan summaries → guideline Q&A. Prerequisites: S3, events, async jobs, `ai_annotations` pattern, guideline corpus | Classification ≥95% acceptance in review UI; measurable minutes-saved per file |

**Standing rules for phases 4–6:**
- First external API is **read-only** (Audit + status timeline for CRM sync) — exercises keys/versioning/webhooks/docs at minimum risk
- AI stays advisory, never auto-decisioning (fair-lending exposure) — human review UI is part of every AI deliverable
- Do not start platform work before Phase 1 closes — a platform with no pilot lender is a platform for nobody

---

## Technical Debt Tracker

| Item | Impact | Effort | Notes |
|---|---|---|---|
| ~~Analytics date columns ambiguous when JOINs added~~ | ~~High — `?date_preset=...` crashed in `_chart_action_needed`~~ | ~~Low~~ | ✅ Done — Sprint 4.2 qualified all date columns with `l.<col>` |
| ~~Analytics `IN (:list)` failed on `varchar` columns~~ | ~~High — multi-value `IN`/`NOT IN` raised 500~~ | ~~Low~~ | ✅ Done — Sprint 4.2 switched to `= ANY(:param)` / `<> ALL(:param)` |
| ~~Analytics `text` filter validator rejected `list[str]`~~ | ~~Medium — masked SQL bug with 422~~ | ~~Low~~ | ✅ Done — Sprint 4.2 validator now accepts scalar or list |
| ~~Pagination on list endpoints~~ | ~~High — breaks at scale~~ | ~~Low~~ | ✅ Done — `skip`/`limit` + `PaginatedResponse[T]` on `/loans` + `/loans/pipeline`. Other endpoints still bare lists — Sprint 2 hardening item. |
| JWT in localStorage → httpOnly cookie | High — security | Medium | Requires server-side session handling |
| ~~`allow_origins=["*"]`~~ | ~~High — security~~ | ~~Low~~ | ✅ Done — locked to `ALLOWED_ORIGINS` env, default `http://localhost:3000` |
| ~~JWT secret in code~~ | ~~High — security~~ | ~~Low~~ | ✅ Done — loaded from env, default rejected in non-local env, rotation invalidates tokens |
| Zero automated test coverage | High — risk for every refactor | Medium | Foundation ✅ done (A.1–A.3); P1 B-gate ✅ done (5 files green); P2 B-gate in Sprint 2 |
| ~~TEXT+CHECK migration~~ | ~~Medium~~ | ~~Low~~ | ✅ Done — migrations 122–125, zero PostgreSQL ENUMs remain |
| No React Query / SWR | Medium — UX | Medium | Add before live API for caching |
| ~~`submissionStore.ts` not wired to API~~ | ~~Medium~~ | ~~Medium~~ | ✅ Done — `saveDraft` syncs header + financials + borrowers + property to backend (Sessions 20–22) |
| Multi-tenant seed for `seed_minimum` | Medium | Low | Unblocks 2 currently-skipped tests — Sprint 2 picks up |
| Other list endpoints still return bare `list[X]` (borrowers, conditions, documents, properties, exceptions, tasks, notes) | Medium | Low | B-gate test only covers `/loans/pipeline`; Sprint 2 hardening item |
| Role vocabulary split — frontend `UserRole` names ≠ backend role constants | High — RBAC correctness | Low | Backend vocabulary is canonical — Sprint 2 Phase 2.1 |
| Business logic inline in routers (`status.py`, `conditions.py`, `loans.py`) | Medium — platform boundary, testability | Medium | Routers parse + authorize; services decide + mutate. `analytics.py` is the template. Migrate opportunistically when touching each domain |
| Mixed data-fetching idioms (React Query + useEffect + Zustand) | Medium — velocity, onboarding | Medium | Rule: all NEW fetching uses React Query; migrate old hooks only when touching them |
| `audit_log` partitioning strategy undecided | Medium at scale | Low (decide) | Write the ADR (partition by `occurred_at`, monthly) before the table crosses ~10M rows — retrofitting partitioning on a hot table is painful |
| `getLoanById` fetches pipeline with `limit=1000` | Low — perf smell | Low | Replace with `GET /loans/{id}` when workspace hooks are touched (Sprint 3) |
| `@shadcn/ui` package is a dummy v0.0.4 | Low | Low | Run `npx shadcn@latest init` when ready for UI primitives |
| bcrypt 4.0.1 pinned | Low | Low | passlib incompatible with bcrypt 4.1+ |
| `_legacy/` pages in routing | Low | Low | Not routed, reference only |

---

## Projection

### To reach demo-ready (first external walkthrough)
**Estimated:** 1–2 sessions
- ✅ Testing harness built (`tests/backend/conftest.py`, `tests/frontend/setup.ts`, `scripts/run_tests.sh`)
- Loan submission fully wired to API (atomic 3-table insert)
- Pagination added to all list endpoints
- CORS + JWT secret secured (env var, localhost whitelist)
- At least 2 real user accounts (AE, broker) via `POST /api/v1/users/`
- WorkspaceHome shows real loan_financials + loan_terms data

### To reach MVP (internal team use)
**Estimated:** 6–8 weeks after demo-ready
- Conditions management UI complete
- Documents upload (S3 or mock with real file tracking)
- Notes / internal conversation
- Status transition UI
- Real user onboarding

### To reach production
**Estimated:** 3–4 months after MVP
- Full security hardening (httpOnly cookies, rate limiting, HTTPS)
- Full test coverage (backend pytest suite, frontend component tests)
- Real pricing engine integration
- Notification system
- Admin panel
- Multi-tenant onboarding flow

---

## Demo Script (current capabilities)

**Borrower flow:**
1. Visit `http://localhost:3000/borrower/welcome`
2. Click "Get Started" → answer 7 questions (property type, occupancy, purpose, amount, credit, income, employment)
3. See ranked program cards with match scores and rate ranges
4. Click "Connect with a Specialist" → submit email
5. Handoff lead is stored in `intake_handoffs` table

**Ops flow:**
1. Visit `http://localhost:3000/login`
2. Login: `admin@origina.dev` / `TestPass123!`
3. Land on Account Executive dashboard
4. Click "Loan Pipeline" → see 202 real Non-QM loans
5. Use search, filters, sorting, saved views — all instant
6. Click any loan number → enter loan workspace
7. Navigate sections (Home, Processing, Underwriting, Conditions, etc.)
8. Click "Analytics" in sidebar → see all charts and KPIs

**Start commands:**
```bash
# Terminal 1
docker-compose up -d

# Terminal 2
cd src/backend && python3 -m uvicorn app.core.main:app --reload

# Terminal 3
cd src/frontend && npm run dev
```

---

## Documentation Maintenance Rules

- **Update "Current State"** at the start of every major feature session.
- **Move items from Priority lists to "What We Did Well"** when completed — keep the history of what was built and why it mattered.
- **Update the Technical Debt Tracker** when items are resolved (mark ✅) or when new debt is incurred.
- **Update Projection timelines** after major milestones — stale estimates mislead planning.
- **Every checklist item ships with its matching test.** When moving a checklist item from a Priority list into **"What We Did Well"**, link the test file path(s) in the entry. An item without a passing test cannot be moved. See [Testing Checkpoints — Definition of Done](#definition-of-done-applies-to-every-roadmap-checklist-item).
- Architecture decisions that justify roadmap choices belong in [DECISIONS.md](DECISIONS.md).
