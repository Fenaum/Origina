# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Origina is a Non-QM (Non-Qualified Mortgage) Loan Origination System (LOS) and Third Party Origination (TPO) platform. Backend is FastAPI/Python, database is PostgreSQL, frontend is Next.js/TypeScript.

**Target users:** Wholesale channel — loan officers, processors, underwriters, account managers, and brokers.
**Product focus:** Non-QM products (DSCR, Bank Statement, Asset Depletion, Interest Only, Jumbo Non-QM). No AI/ML features — intentionally out of scope.

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

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full prioritized backlog and testing gates.

**Priority 1 — Demo-blocking (none of these are done yet):**
1. **Pagination** — all list endpoints return unbounded results; add `skip`/`limit` + `{"items": [...], "total": n}` envelope
2. **CORS lockdown** — currently `allow_origins=["*"]`; lock to `http://localhost:3000` in dev
3. **JWT secret from environment** — `JWT_SECRET_KEY` in `core/config.py` must load from env, reject hardcoded default at startup
4. **Loan submission wired to API** — `submissionStore.ts` auto-saves to DB via `saveDraft`; verify the full submit flow creates loan + loan_financials + loan_terms atomically
5. **Real loan_financials + loan_terms in WorkspaceHome** — workspace home currently shows only header fields

**Priority 2 — Core workflow (after first demo):**
1. **Real user creation** — only `admin@origina.dev` works today; need `POST /api/v1/users/` + multi-user demo accounts
2. **Role stored in DB** — currently inferred from email prefix; fix `get_current_user` to read `users.role` column
3. **Conditions workspace UI** — currently a placeholder; needs list, clear/waive/reject actions, add form
4. **Pipeline pagination wired in frontend** — wire `skip`/`limit` to `PipelineGrid` with page controls

## Technical debt (active items)

| Item | Impact | Effort |
|---|---|---|
| Pagination on list endpoints | High — breaks at scale | Low |
| JWT in localStorage → httpOnly cookie | High — security | Medium |
| `allow_origins=["*"]` | High — security | Low |
| JWT secret loaded from env | High — security | Low |
| Zero feature test coverage | High — risk on every refactor | Medium |
| No React Query / SWR for submission store | Medium — UX | Medium |
| `@shadcn/ui` package is a dummy v0.0.4 | Low | Low — run `npx shadcn@latest init` when ready |
| `bcrypt 4.0.1` pinned | Low | Low — passlib incompatible with 4.1+ |
