# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Origina is a Non-QM (Non-Qualified Mortgage) Loan Origination System (LOS) and Third Party Origination (TPO) platform. Backend is FastAPI/Python, database is PostgreSQL, frontend is Next.js/TypeScript.

**Target users:** Wholesale channel — loan officers, processors, underwriters, account managers, and brokers.
**Product focus:** Non-QM products (DSCR, Bank Statement, Asset Depletion, Interest Only, Jumbo Non-QM). AI/ML features are deferred until the platform prerequisites exist (S3 storage, domain events, async jobs) — do not build AI features now, but do not make choices that block them. See "AI Scope" ADR in [docs/DECISIONS.md](docs/DECISIONS.md).

**Architecture docs:** `docs/architecture/` — see [docs/architecture/README.md](docs/architecture/README.md) for the index. Each domain has its own file (backend, database, frontend, loan-workspace, exceptions, integrations, settings, feature-guides).

---

## Commands

### Backend

```bash
# Start dev server (from repo root)
cd src/backend && uvicorn app.core.main:app --reload
# API docs: http://localhost:8000/docs
```

### Frontend

```bash
cd src/frontend
npm run dev      # http://localhost:3000
npm run lint     # ESLint
npm run build    # Production build
```

### Database

```bash
docker-compose up -d          # Start PostgreSQL (localhost:5432, db: originadb, user: origina, pass: origina123)
scripts/db_init.sh            # Initialize schema (applies all pending numbered SQL migrations)
scripts/db_migrate.sh         # Apply only pending migrations (safe to re-run)
scripts/db_reset.sh           # Wipe and reinitialize (dev only — runs docker-compose down -v then up -d then db_init.sh)
```

**Full reset from scratch:**
```bash
docker-compose down -v   # destroys volume
docker-compose up -d
scripts/db_init.sh
python3 scripts/seed_nonqm_loans.py   # 202 wholesale Non-QM loans
```

### Tests

```bash
./scripts/run_tests.sh           # run backend + frontend
./scripts/run_tests.sh backend   # backend only (pytest)
./scripts/run_tests.sh frontend  # frontend only (vitest)
```

See [docs/TESTING.md](docs/TESTING.md) for setup, fixtures, writing new tests, and CI integration.

### Python environment

```bash
cd src/backend
pip install -r ../../requirements.txt
```

### Seed data

```bash
python3 scripts/seed_nonqm_loans.py   # inserts 202 wholesale Non-QM loans into origina-dev tenant
python3 scripts/bootstrap_user.py     # creates admin@origina.dev / TestPass123! for login testing
```

No backend linter is configured.

---

## Architecture

### Backend (`src/backend/app/`)

Clean layered architecture:

| Layer | Path | Role |
|---|---|---|
| API | `api/v1/` | FastAPI routers, one file per domain |
| Services | `services/*_repo.py` | Business logic (named `*_repo.py` by convention — they are services, not repositories) |
| Models | `models/` | SQLAlchemy ORM models |
| Schemas | `schemas/` | Pydantic request/response validation |
| Security | `security/` | JWT auth, RBAC, role definitions |
| Core | `core/` | Config, DB session factory, logging, app factory |

**Entry point**: `core/main.py` creates the FastAPI app and registers all 27 routers (~167 routes total) under `/api/v1/`.

**DB session**: All endpoints get a `Session` via `Depends(get_db)` from `core/db.py`. Never instantiate sessions directly.

**Write endpoints** use `Depends(get_audited_db)` instead of `get_db`. This dependency executes `SET LOCAL app.current_user_id = :uid` before any DML so audit triggers know the actor. It is scoped to the transaction and clears automatically on commit/rollback.

**Base models**:
- `BaseModel` — mutable tables (UUID PK, `created_at`, `updated_at`, `tenant_id`)
- `AppendOnlyModel` — event/log tables (UUID PK, `created_at` only, no `updated_at`)
- Satellite tables (`loan_financials`, `loan_terms`) use `loan_id` as PK+FK to enforce 1:1 at schema level

**Schemas**: Pydantic schemas use `ConfigDict(from_attributes=True)` for ORM compatibility. Pattern: `<Domain>Base` → `<Domain>Create` / `<Domain>Update` → `<Domain>Out`.

**Status/type constants**: All domain constants use plain classes with string values and frozensets — no Python Enums, no `.value` access:
```python
class LoanStatus:
    NEW_DRAFT = "new_draft"
    SUBMITTED = "submitted"
    TERMINAL: frozenset[str] = frozenset({"denied", "withdrawn", "cancelled", "archived"})
    ALL: frozenset[str] = frozenset({...})
```
This pattern applies to `LoanStatus`, `LoanPurpose`, `ConditionStatus`, `TaskStatus`, `TaskPriority`, `ExceptionStatus`, `ExceptionSeverity`, and all other status types.

**Auth flow**:
- `POST /api/v1/auth/login` (OAuth2PasswordRequestForm) → returns `{access_token, token_type}`
- JWT stored in localStorage under `origina.token`
- `apiClient.ts` reads this and injects `Authorization: Bearer <token>` on every request
- `GET /api/v1/auth/me` → hydrates user context on app mount
- `get_current_user` decodes JWT, fetches User ORM object, checks `is_active`
- `require_roles(*allowed)` is a dependency factory for per-route RBAC

**Role constants** (must match `roles` table values):
```python
LOAN_OFFICER    = "loan_officer"
PROCESSOR       = "loan_processor"
UNDERWRITER     = "underwriter"
ACCOUNT_MANAGER = "account_manager"
IT_ADMIN        = "it_admin"
```

---

### Database (`db/`)

Raw SQL migrations in `db/migrations/` are the schema source of truth. The migration runner (`scripts/init_db.py`) tracks applied files in `schema_migrations` and runs each file in its own transaction.

**Do not use `Base.metadata.create_all()`** — it cannot safely manage PostgreSQL triggers, partial indexes, or TEXT+CHECK constraints.

**Migration numbering (125 migrations applied):**
- 010 tenants → 020 users/RBAC → 030 types (obsolete ENUMs — all replaced) → 040 parties
- 050 loans → 055 conditions → 060 properties
- 070–073 workflow (exceptions, tasks, notes, loan_status_events)
- 080 documents → 090 decisions → 100 audit snapshots → 101 borrowers
- 102–109 optimization/hardening (audit columns, check constraints, indexes, loan split, audit trigger fix)
- 110 borrower intake → 111 condition enhancements → 112 documents v2 → 113 property details
- 114 appraisal → 115 credit reports → 116 escrow → 117 title orders
- 118–121 exceptions v2 (nullable loan_id, structured fields, events/comments, decisions)
- 122–125 TEXT+CHECK migration (all ENUM columns converted — zero ENUMs remain)

**Next planned:** 126–131 for Settings module.

**No PostgreSQL ENUM columns remain.** Every domain-status column is `TEXT NOT NULL` with a `CHECK` constraint. This is intentional — see [docs/DECISIONS.md](docs/DECISIONS.md).

**Loan split pattern**: `loans` holds header fields only. Financial amounts live in `loan_financials`; rate/term structure in `loan_terms`. Both use `loan_id` as PK. Always insert all three when creating a loan.

**Controlled values architecture**:
- `controlled_value_sets` + `controlled_values` tables (18 sets, 144+ seed values)
- `tenant_id IS NULL` = system default; `tenant_id = X` = tenant override that shadows the system row
- API: `GET /api/v1/metadata/values/{set_code}` merges system + tenant rows
- Adding a new value requires only an `INSERT` — no migration, no deploy

**Audit triggers** fire AFTER INSERT/UPDATE/DELETE on 8 tables: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`, `exceptions`, `loan_status_events`. The trigger function (`log_audit_event()`) reads the actor from `app.current_user_id` and writes a diff to `audit_log`. Tables with `loan_id` as PK (not `id`) are handled via the `_LOAN_ID_PK` array in the trigger function.

---

### Loan workflow

Full `loan_status` values: `new_draft → submitted → conditions_review → approved_pending → approved → funded → closed → post_closing → archived` (terminal: `denied`, `withdrawn`, `cancelled`)

Status transitions are recorded in `loan_status_events` (append-only). The `loans.status` column holds the current state for querying. Both must be updated together atomically.

Condition lifecycle: `outstanding → submitted → cleared / waived / rejected`

---

### Multi-tenancy

`tenants` is the root table. Every model carries `tenant_id`. Isolation is enforced at the query level — every read and write filters or checks `tenant_id`. The `tenant_id` is never accepted from request body — always derived from the authenticated user's JWT payload.

---

### Frontend (`src/frontend/`)

Next.js 16 with TypeScript strict mode, Tailwind CSS v4, Recharts. Uses the **page router** (not App Router).

**Core libraries:**
- `@tanstack/react-query` — all data fetching; `QueryClientProvider` wraps the entire app in `_app.tsx`
- Zustand 5 with `persist` + `immer` middleware — 6 stores (auth, pipeline, recentLoans, intake, submission, document)
- CSS design system via variables in `globals.css` — no CSS-in-JS

**Directory structure:**
```
src/
  pages/          # Routes — one file per page
    _app.tsx      # QueryClientProvider + AuthProvider wrapper
    _legacy/      # Archived placeholder pages (not routed, do not delete)
    analytics/    # Analytics dashboard
    borrower/     # Intake + application flow
    dashboard/    # Role dashboards
    exceptions/   # Pre-file exceptions
    loans/        # Pipeline table + loan workspace
    settings/     # Personal settings (profile, security, notifications, preferences)
    admin/        # Org admin (people, products, workflow, audit log, etc.)
    login.tsx
  components/
    app/          # Shell: AppLayout, LoanWorkspaceLayout, SettingsLayout, Sidebar, TopHeader
    analytics/    # MetricCard, ChartCard, DrilldownPanel, DrilldownTable, filter components
    borrower/     # Intake UI
    charts/       # Recharts wrappers
    dashboard/    # DashboardCard, StatusList, PageHeader, RoleDashboard
    feedback/     # LoadingSpinner, EmptyState, ErrorState, skeletons
    loans/        # Pipeline + workspace components
      pipeline/   # Toolbar, KPIs, Grid, FilterPanel, action modals
      workspace/  # WorkspaceHome + all 20+ section components, workspaceSections.ts
    settings/     # SettingsLayout, SectionCard, SaveBar, SearchableSectionNav
    submission/   # Multi-step loan submission wizard
  hooks/          # Data-fetching hooks — useAuth, useLoans, useLoan, useCurrentUser, …
  services/       # apiClient.ts (fetch wrapper), loanService.ts, submissionService.ts
  state/          # auth.tsx, pipelineStore.ts, recentLoansStore.ts, submissionStore.ts, …
  types/          # auth.ts, loan.ts, dashboard.ts, api.ts, analytics.ts, submission.ts
  lib/            # utils.ts — cn(), formatCurrency(), formatDate(), formatPercent()
  data/           # mockLoans.ts, mockDashboard.tsx, pipelineAnalytics.ts, templates.ts
  styles/         # globals.css — design system, CSS variables, layout; analytics.css
```

**Auth**: JWT stored in localStorage under `origina.token`. `apiClient.ts` reads this and injects `Authorization: Bearer <token>` on every request. On mount, `_app.tsx` calls `GET /auth/me` to hydrate user context. Role-based sidebar and page guards (`<AppLayout allowedRoles={[...]}>`) enforce access client-side; backend RBAC is the real gate.

**Data fetching**: All hooks use `useQuery`/`useMutation` from React Query. Do not write `useEffect + fetch` loops for data fetching.

**Target data flow:**
```
Login → POST /auth/login → JWT in localStorage
  → apiClient.ts injects Bearer header
  → service layer (loanService, submissionService, etc.)
  → React Query hooks (useLoans, useLoan, useCurrentUser, …)
  → components render with cached data
```

**SSN security invariant**: `submissionStore.ts` uses `partialize` to strip `borrowers[].ssn` before every localStorage write. SSN lives in Zustand memory only during the session. This is an inviolable security invariant — do not remove or weaken the `partialize` guard.

---

## Adding new features

**New API endpoint:**
1. Add Pydantic schema in `schemas/<domain>_schema.py`
2. Add route to `api/v1/<domain>.py` — use `Depends(get_audited_db)` for writes, `Depends(get_db)` for reads
3. Implement logic in `services/<domain>_repo.py`
4. Return `<Domain>Out` schema
5. Mirror the response shape in `src/frontend/src/types/api.ts`

**New database table:**
1. Create `db/migrations/<next_number>_<name>.sql` (next is 126+)
2. Add SQLAlchemy model in `models/`
3. Run `scripts/db_migrate.sh`
4. New status/type columns must be `TEXT NOT NULL CHECK (col IN (...))` — never `ENUM()`
5. If the table needs auditing, attach `log_audit_event()` trigger (add table name to `_LOAN_ID_PK` array in trigger function if PK is `loan_id` not `id`)
6. Update migration sequence in `docs/architecture/database.md`

**New frontend page:**
1. Add file to `src/pages/<domain>/index.tsx` (or `[id].tsx` for detail)
2. Wrap with `<AppLayout allowedRoles={[...]}>` for auth guard (or `SettingsLayout` for settings/admin pages)
3. Add `useQuery`-based hook in `src/hooks/` for any data fetching
4. Add route to sidebar nav in `components/app/Sidebar.tsx` with `roles` array

---

## Key conventions

**Backend:**
- Service files use suffix `_repo.py` even though they contain service/business logic
- Logger name: `origina_backend` (configured in `core/logging.py`)
- API versioned under `/api/v1/` — all new routes go there
- `tenant_id` is never accepted from request body — always from `current_user.tenant_id`
- S3 is the document storage backend — out of scope until core loan flow is working
- `bcrypt==4.0.1` is pinned in requirements.txt — passlib is incompatible with bcrypt 4.1+
- No Python Enum types for status/type constants — use plain class constants with frozensets

**Frontend:**
- Import with `@/*` alias (maps to `src/frontend/src/`)
- Hooks live in `src/hooks/` — not co-located in components
- API response types live in `src/types/api.ts` — keep in sync with backend schemas
- `src/lib/utils.ts` provides `cn()`, `formatCurrency()`, `formatDate()`, `formatPercent()`
- All data fetching goes through React Query (`useQuery`/`useMutation`) — not raw `useEffect + fetch`
- `types/loan.ts` defines `LoanProgram` including conventional/other (pipeline display)
- `types/submission.ts` defines `LoanProgram` as Non-QM subset only (submission wizard) — keep these separate
- `pages/_legacy/` contains archived placeholder pages — not routed, kept for reference, do not delete
- CSS lives in `globals.css` (and `analytics.css` for the analytics dashboard) — no CSS-in-JS

**Tests:**
- Backend: `tests/backend/` — pytest with schema-per-test-run isolation, async ASGI client
- Frontend: `tests/frontend/` — vitest + jsdom + Testing Library
- Always run from repo root: `./scripts/run_tests.sh`
- Mark backend tests `@pytest.mark.smoke` (no DB) or `@pytest.mark.integration` (touches DB)
- See [docs/TESTING.md](docs/TESTING.md) for full setup and writing guide

---

## What to build next (priority order)

**Work is organized into sprints.** The active sprint lives in [docs/CURRENT_SPRINT.md](docs/CURRENT_SPRINT.md); the full sprint plan and archive is [docs/sprints/README.md](docs/sprints/README.md); each sprint has a detailed build spec in `docs/sprints/sprint-N-build-spec.md`. See [docs/ROADMAP.md](docs/ROADMAP.md) for the full backlog and testing gates.

**Sprint 1 — Demo Unblocked — ✅ closed 2026-07-07.** JWT secret from env, CORS locked, pipeline pagination (`PaginatedResponse[T]` envelope), atomic loan submission, real financials/terms in WorkspaceHome. All B-gate tests green.

**Sprint 2 — Core Workflow — ✅ closed 2026-07-09.** Real user creation with RBAC, role vocabulary reconciliation, condition lifecycle state machine, conditions workspace UI, pagination envelope on remaining list endpoints. Spec: [docs/sprints/sprint-2-build-spec.md](sprint-2-build-spec.md). Archive: [docs/sprints/sprint-2-core-workflow.md](docs/sprints/sprint-2-core-workflow.md).

**Sprint 3 — Full Workspace — ✅ closed 2026-07-09.** Notes + audit log + status transition UI wired end-to-end in the workspace. Underwriting tab now surfaces pricing/eligibility runs + exceptions. Documents section uploads/lists/downloads/archives real files. 10 new backend tests, 4 new frontend services, 4 rewritten workspace components. Spec: [docs/sprints/sprint-3-build-spec.md](sprint-3-build-spec.md). Archive: [docs/sprints/sprint-3-full-workspace.md](docs/sprints/sprint-3-full-workspace.md).

**Sprint 4 — Manager Layer — ✅ closed 2026-07-09.** Pipeline `LoanSummary.owner` from `users.full_name` JOIN; `?assigned_to=<uuid>` + `?status_filter=<status>` filter the pipeline. Analytics filter bug fixes (date columns qualified with `l.<col>`, `IN(:list)` → `= ANY(:param)`, validator accepts `list[str]`) — `?date_preset=...` no longer crashes. `/dashboard/manager` page renders `TeamKPICard` grid driven by `useAnalyticsSummary`; date-preset selector re-fires the request. `domain_events` outbox (migration 131) + `event_service` + `notification_consumer` routes `loan.submitted` → assignee and `loan.status_changed → conditions_review` → all underwriters via SMTP (disabled by default). 13 new backend tests + 4 new frontend tests. Spec: [docs/sprints/sprint-4-build-spec.md](sprint-4-build-spec.md). Archive: [docs/sprints/sprint-4-manager-layer.md](docs/sprints/sprint-4-manager-layer.md).

**Sprint 5 — Production Hardening — ✅ closed 2026-07-10.** httpOnly cookie auth (`origina_token` HttpOnly + SameSite=Lax, `/auth/logout` clears it, dual-mode cookie OR Bearer accepted by `get_current_user`); rate limiting on `/auth/login` via slowapi (10/min/IP, configurable via `LOGIN_RATE_LIMIT`); GitHub Actions CI on every PR (`.github/workflows/ci.yml`) with backend coverage gate (`--cov-fail-under=70`) + condition-lifecycle gate (`--cov-fail-under=90`); `POST /api/v1/tenants/bootstrap` guarded by `ADMIN_SECRET` creates tenant + first IT_ADMIN user in one atomic call; Settings → Admin → Tenant Onboarding UI for non-CLI onboarding; 68 new backend tests + 3 new frontend smoke tests; `npm run lint` reports 0 problems (was 22). Spec: [docs/sprints/sprint-5-build-spec.md](docs/sprints/sprint-5-build-spec.md). Archive: [docs/sprints/sprint-5-production-hardening.md](docs/sprints/sprint-5-production-hardening.md).

**Sprint 6 — In progress (started 2026-07-11).** Phase 6.0 carries over the Sprint 1–5 post-close audit items: RBAC route-coverage matrix (`test_rbac_coverage.py`), the skipped intake-lifecycle test masking a real error (`test_coverage_gaps.py:1005`), migration-based test runner in `conftest.py`, and named regression tests for BUG-2026-07-09-001/002/003. Remaining phases await owner-authored spec. See [docs/CURRENT_SPRINT.md](docs/CURRENT_SPRINT.md).

**Long-term direction:** Origina's backend is intended to evolve into a platform (APIs consumable by CRMs, mobile apps, external LOS). Key architectural commitments: domain events table (transactional outbox) shipped in Sprint 4 — webhooks, SLA timers, and AI triggers will subscribe as additional consumer files (one consumer, one file that knows its transport); routers stay thin (parse + authorize), business logic lives in services. See ADRs in [docs/DECISIONS.md](docs/DECISIONS.md).

## Technical debt (active items)

| Item | Impact | Effort |
|---|---|---|
| ~~JWT in localStorage → httpOnly cookie~~ | ~~High — security~~ | ✅ Done in Sprint 5 |
| Role vocabulary split (frontend role names ≠ backend role constants) | High — RBAC correctness | Low — Sprint 2 |
| Bare `list[X]` on non-loan list endpoints (conditions, tasks, notes, users, audit, documents) | Medium — API consistency | ✅ Done in Sprint 2 |
| Test schema doesn't install triggers (`create_all()` skips PL/pgSQL) | Low — test infra friction | Low — Sprint 3 inline-install stopgap in place; migration-based runner scheduled: Sprint 6 Phase 6.0 |
| RBAC route coverage — `test_rbac_coverage.py` role × route matrix never written; only `/users/` has RBAC tests | Medium — authz regressions invisible | Low — scheduled: Sprint 6 Phase 6.0 |
| Branch protection on `main` not enabled — CI runs but red builds do not actually block merge | Medium — the "red blocks merge" claim is a repo setting away from true | Trivial — GitHub → Settings → Branches → require Backend + Frontend checks |
| Frontend bugs BUG-2026-07-09-001/002/003 have manual-only regression coverage (gate says every bug gets a named test) | Low — regressions could return silently | Low — scheduled: Sprint 6 Phase 6.0 |
| Skipped intake test masks a real error (`test_coverage_gaps.py:1005` — "Multiple rows were found") | Medium — possible product bug in intake flow | Low — scheduled: Sprint 6 Phase 6.0 |
| Business logic inline in routers (status.py, conditions.py, loans.py) | Medium — platform boundary | Migrate opportunistically when touching each domain |
| ~~Feature test coverage below 70% gate~~ | ~~Medium — refactor risk~~ | ✅ Done in Sprint 5 — CI enforces `--cov-fail-under=70`; current 70.30% |
| Mixed data-fetching idioms (React Query + useEffect + Zustand) | Medium — velocity | All NEW fetching uses React Query; migrate old hooks only when touching them |
| `@shadcn/ui` package is a dummy v0.0.4 | Low | Low — run `npx shadcn@latest init` when ready |
| `bcrypt 4.0.1` pinned | Low | Low — passlib incompatible with 4.1+ |
