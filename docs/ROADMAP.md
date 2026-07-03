# Origina LOS — Project Roadmap

> **Cross-links:** [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md) | [TESTING.md](TESTING.md)

## Current State (as of June 2026)

The platform has a working end-to-end demo path:
1. Borrower visits `/borrower/welcome` → completes intake → sees program recommendations → submits handoff
2. AE logs in at `/login` → sees pipeline of 202 real seeded loans → opens any loan file → browses workspace sections
3. AE views analytics at `/analytics` → KPIs, charts, volume trends
4. AE manages exceptions at `/exceptions` → creates pre-file exceptions → attaches approved exceptions to loans

**What is real:** Auth, pipeline API, 202 seeded Non-QM loans, borrower intake (DB), analytics from live data, full exception module (25 routes), controlled values architecture (18 sets, 144 values), metadata API.
**What is mock:** Loan submission wizard not wired to API (drafts in localStorage), document upload (simulated), pricing (hardcoded scenarios), MISMO parsing (stub).
**Testing foundation:** pytest + vitest harnesses bootstrapped (Day 1 of P1) — see **Testing Checkpoints** below. Zero feature tests written yet; smoke tests only.

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

---

## Priority 1 — Demo-Blocking (must be done before first real demo)

### Backend
- [ ] **Pagination** — all list endpoints return unbounded results
  - Add `skip: int = 0, limit: int = 50` to all list routes
  - Return `{"items": [...], "total": n}` envelope
  - Update `types/api.ts` to match
  - _Reason: 202 loans is fine now, but 2,000 will break the browser_

- [ ] **CORS lockdown** — currently `allow_origins=["*"]`
  - Lock to `http://localhost:3000` in dev, real domain in prod
  - _Reason: security requirement before any external access_

- [ ] **JWT secret rotation**
  - Replace dev default `JWT_SECRET_KEY` in `core/config.py`
  - Load from environment variable, not hardcoded
  - _Reason: demo instances must not share the dev secret_

### Frontend
- [ ] **Loan submission to real API**
  - `submissionService.ts` currently stores drafts in localStorage only
  - Wire `POST /api/v1/loans/` to create loan + `loan_financials` + `loan_terms` atomically
  - _Reason: a borrower completes intake, gets a program match, but their loan never enters the pipeline_

- [ ] **Real loan_financials + loan_terms in WorkspaceHome**
  - Current workspace home shows only `LoanSummary` fields (no financial details)
  - Need `GET /api/v1/loans/{id}/financials` and terms
  - _Reason: loan file is incomplete without amounts and rate terms_

---

## Testing Checkpoints

> Every roadmap checklist item ships with its matching test file. A milestone is **not cleared** until every test listed below for that milestone is green. Tests live under `tests/backend/` and `tests/frontend/` (see [ARCHITECTURE.md](ARCHITECTURE.md) for conventions).
>
> 📖 **How-to / setup / troubleshooting → [TESTING.md](TESTING.md).** This section is the plan; TESTING.md is the operator's manual.

### A. Foundation — Day 1 of P1 (blocks all other test work)

- [ ] **A1. Backend `pytest` harness**
  - `tests/backend/conftest.py` with async fixtures: `test_engine`, `test_db`, `client`, `seed_minimum`
  - `pytest.ini` with `asyncio_mode=auto`, `testpaths = tests/backend`
  - **Test isolation strategy:** schema-per-test-run (`SET search_path TO test_origina_<uuid>`) inside the existing `originadb` Postgres instance — no separate DB container, no testcontainers. Re-uses dev migrations via `scripts/init_db.py`.
  - **Smoke test:** `tests/backend/test_health.py::test_health_endpoint_returns_ok` — `GET /api/v1/health/` returns 200 + `{"status": "healthy", ...}`
  - **Smoke test:** `tests/backend/test_health.py::test_root_serves_metadata` — `GET /` returns 200 with `service` / `api_prefix` fields

- [ ] **A2. Frontend `vitest` harness**
  - `tests/frontend/setup.ts` — registers `@testing-library/jest-dom` matchers
  - `tests/frontend/vitest.config.ts` — `environment: 'jsdom'`, alias `@/*` → `./src/*` (matches `tsconfig.json` paths)
  - **Smoke test:** `tests/frontend/LoanPipelineTable.test.tsx::renders_empty_state_when_no_loans` — renders the `EmptyState` panel
  - **Smoke test:** `tests/frontend/LoanPipelineTable.test.tsx::renders_table_rows_for_loans` — given 2 mock loans, both rows appear with loan numbers and amounts

- [ ] **A3. Unified runner**
  - `scripts/run_tests.sh` — runs `pytest tests/backend/ -v`, then `cd src/frontend && npm run test`
  - Exits non-zero on any failure
  - Print PASS/FAIL summary at the end

### B. Priority 1 Gate Tests (must be green to clear P1)

- [ ] **Pagination envelope** → `tests/backend/test_pagination_envelope.py`
  - `GET /api/v1/loans?skip=0&limit=50` returns `{"items": [...], "total": int}` with `len(items) <= 50`
  - `total` matches `SELECT COUNT(*) FROM loans` for the tenant
  - `skip` and `limit` are honored (offset semantics correct)
  - Frontend component test: `PipelineGrid` renders page controls and fires new requests on page change

- [ ] **CORS lockdown** → `tests/backend/test_cors.py`
  - `OPTIONS` from disallowed origin returns **no** `Access-Control-Allow-Origin` header
  - `OPTIONS` from `http://localhost:3000` (dev whitelist) returns correct `Access-Control-Allow-Origin`
  - Credentials flag still respected

- [ ] **JWT secret rotation** → `tests/backend/test_auth_secret_from_env.py`
  - Token issued at startup is signed with `os.environ['JWT_SECRET_KEY']`
  - Changing `JWT_SECRET_KEY` invalidates previously-issued tokens
  - Default `"change-me-in-production"` is rejected (raises on startup)

- [ ] **Loan submission to real API** → `tests/backend/test_loan_submission_e2e.py`
  - Happy path: `POST /api/v1/loans/` with valid payload creates `loans` row + `loan_financials` row + `loan_terms` row atomically
  - Tenant scoping: a loan submitted as tenant A is invisible to tenant B queries
  - Rollback: invalid payload leaves no partial rows in any of the three tables

- [ ] **WorkspaceHome financials** → `tests/backend/test_loan_financials_endpoint.py` + `tests/frontend/WorkspaceHome.test.tsx`
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
- [ ] Notification system (email on handoff, status change)
- [ ] Loan status transition validation (enforce state machine)
- [x] Exception module — 25 routes, full lifecycle, decisions, conditions, pre-file
- [x] Task management endpoints — full CRUD + status transitions
- [ ] Notes/internal conversation endpoint
- [ ] Full URLA (1003) data model and API

### Frontend
- [ ] Processing section — milestone checklist
- [ ] Underwriting section — decision panel, exception tracking
- [ ] Documents section — upload, categorize, link to conditions
- [ ] Notes section — threaded internal conversation
- [ ] Audit Log section — real `audit_log` table data
- [ ] Loan creation form (`/loans/new/manual`) — multi-step, currently placeholder
- [ ] Status transition UI in workspace topbar
- [ ] Borrower panel in workspace home (co-borrowers, contact info)
- [ ] Property panel (address, type, appraised value)
- [ ] Analytics: date range filter
- [ ] Analytics: export to PDF/image
- [ ] Pipeline: assignment columns (requires backend `LoanSummary` to include AE/processor/underwriter names)
- [ ] Pipeline: priority field (requires DB column + API field)
- [ ] Pipeline: bulk actions (select multiple rows)
- [ ] Right-side activity panel in pipeline (recent loan updates, status changes)
- [ ] React Query / SWR for data caching and background refetch

---

## Priority 4 — Manager & Reporting Layer (post-MVP)

- [ ] Manager analytics dashboard (team KPIs, workload distribution charts)
- [ ] Performance reporting (processing time, approval rates by product)
- [ ] Team KPI pivot tables
- [ ] Pipeline forecasting
- [ ] Funnel conversion rates (submitted → approved → funded)
- [ ] Custom user dashboards
- [ ] Real-time notifications (WebSocket or SSE)

---

## Technical Debt Tracker

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Pagination on list endpoints | High — breaks at scale | Low | `skip`/`limit` params + total count |
| JWT in localStorage → httpOnly cookie | High — security | Medium | Requires server-side session handling |
| `allow_origins=["*"]` | High — security | Low | Config change only |
| JWT secret in code | High — security | Low | Environment variable |
| Zero automated test coverage | High — risk for every refactor | Medium | Bootstrap harness Day 1 of P1, see [Testing Checkpoints](#testing-checkpoints) |
| ~~`loans.status` as `text` vs enum~~ | ~~Medium~~ | ~~Low~~ | ✅ Done — migrations 122–125, zero ENUMs remain |
| No React Query / SWR | Medium — UX | Medium | Add before live API for caching |
| `submissionStore.ts` not wired to API | Medium | Medium | Core demo flow |
| `@shadcn/ui` package is a dummy v0.0.4 | Low | Low | Run `npx shadcn@latest init` when ready for UI primitives |
| bcrypt 4.0.1 pinned | Low | Low | passlib incompatible with bcrypt 4.1+ |
| `_legacy/` pages in routing | Low | Low | Not routed, reference only |

---

## Projection

### To reach demo-ready (first external walkthrough)
**Estimated:** 2–3 weeks
- Loan submission wired to API
- Pagination added
- CORS + JWT secret secured
- At least 2 real user accounts (AE, broker)
- WorkspaceHome shows real loan details
- **Testing harness built — Day 1 of P1** (`tests/backend/conftest.py`, `tests/frontend/setup.ts`, `scripts/run_tests.sh`)

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
