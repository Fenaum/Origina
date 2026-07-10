# .clinerules

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Origina is a Non-QM (Non-Qualified Mortgage) Loan Origination System (LOS) and Third Party Origination (TPO) platform. Backend is FastAPI/Python, database is PostgreSQL, frontend is Next.js/TypeScript.

**Target users:** Wholesale channel — loan officers, processors, underwriters, account managers, and brokers.
**Product focus:** Non-QM products (DSCR, Bank Statement, Asset Depletion, Interest Only, Jumbo Non-QM). No AI/ML features — intentionally out of scope.

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
python3 scripts/seed_nonqm_loans.py   # 200 wholesale Non-QM loans
```

### Python environment

```bash
cd src/backend
pip install -r ../../requirements.txt
```

### Seed data

```bash
python3 scripts/seed_nonqm_loans.py   # inserts 200 wholesale Non-QM loans into origina-dev tenant
python3 scripts/bootstrap_user.py     # creates admin@origina.dev / TestPass123! for login testing
```

No backend linter is configured. No test suite exists yet.

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

**Entry point**: `core/main.py` creates the FastAPI app and registers all 14 routers (82 routes total).

**DB session**: All endpoints get a `Session` via `Depends(get_db)` from `core/db.py`. Never instantiate sessions directly.

**Write endpoints** use `Depends(get_audited_db)` instead of `get_db`. This dependency executes `SET LOCAL app.current_user_id = :uid` before any DML so audit triggers know the actor. It is scoped to the transaction and clears automatically on commit/rollback.

**Base models**:
- `BaseModel` — mutable tables (UUID PK, `created_at`, `updated_at`, `tenant_id`)
- `AppendOnlyModel` — event/log tables (UUID PK, `created_at` only, no `updated_at`)
- Satellite tables (`loan_financials`, `loan_terms`) use `loan_id` as PK+FK to enforce 1:1 at schema level

**Schemas**: Pydantic schemas use `ConfigDict(from_attributes=True)` for ORM compatibility. Pattern: `<Domain>Base` → `<Domain>Create` / `<Domain>Update` → `<Domain>Out`.

**Auth flow**:
- `POST /api/v1/auth/login` (OAuth2PasswordRequestForm) → returns `{access_token, token_type}`
- `get_current_user` decodes JWT, fetches User ORM object, checks `is_active`
- `require_roles(*allowed)` is a dependency factory for per-route RBAC

**Role constants** (must match `roles` table values):
```python
LOAN_OFFICER = "loan_officer"
PROCESSOR    = "loan_processor"
UNDERWRITER  = "underwriter"
ACCOUNT_MANAGER = "account_manager"
IT_ADMIN     = "it_admin"
```

---

### Database (`db/`)

Raw SQL migrations in `db/migrations/` are the schema source of truth. The migration runner (`scripts/init_db.py`) tracks applied files in `schema_migrations` and runs each file in its own transaction.

**Do not use `Base.metadata.create_all()`** — it cannot safely manage PostgreSQL enum types, triggers, partial indexes, or historical changes. Alembic is scaffolded but not used.

**Migration numbering:**
- 010 tenants → 020 users/RBAC → 030 types/enums → 040 parties → 050 loans → 055 conditions → 060 properties
- 070–073 workflow (exceptions, tasks, notes, loan_status_events)
- 080 documents → 090 decisions → 100 audit snapshots → 101 borrowers
- 102–109 optimization/hardening (audit columns, check constraints, indexes, loan split, audit trigger fix)

**Loan split pattern**: `loans` holds header fields only. Financial amounts live in `loan_financials`; rate/term structure in `loan_terms`. Both use `loan_id` as PK. Always insert all three when creating a loan.

**Audit triggers** fire AFTER INSERT/UPDATE/DELETE on: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`. The trigger function (`log_audit_event()`) reads the actor from `app.current_user_id` and writes a diff to `audit_log`. Tables with `loan_id` as PK (not `id`) are handled via the `_LOAN_ID_PK` array in the trigger function.

**Enum types** (must be cast explicitly in raw SQL):
`loan_status`, `loan_purpose`, `loan_party_role`, `borrower_type`, `borrower_income_type`, `borrower_relationship`, `condition_status`, `exception_status`, `exception_severity`, `task_status`, `task_priority`, `party_type`, `party`

**Known schema debt:**
- `loans.status` column is `text` in the live DB (should be `loan_status` enum) — not yet migrated
- `loans.purpose` column is `text` with a legacy check constraint — should align with `loan_purpose` enum

---

### Loan workflow

Full `loan_status` enum: `new_draft → submitted → conditions_review → approved_pending → approved → funded → closed → post_closing → archived` (terminal: `denied`, `withdrawn`, `cancelled`)

Status transitions are recorded in `loan_status_events` (append-only). The `loans.status` column holds the current state for querying. Both must be updated together atomically.

Condition lifecycle: `open → submitted → cleared / waived / rejected`

---

### Multi-tenancy

`tenants` is the root table. Every model carries `tenant_id`. Isolation is enforced at the query level — every read and write filters or checks `tenant_id`. The `tenant_id` is never accepted from request body — always derived from the authenticated user's JWT payload.

---

### Frontend (`src/frontend/`)

Next.js with TypeScript, Tailwind CSS v4, Recharts. Uses the **page router** (not App Router).

**Directory structure:**
```
src/
  pages/          # Routes — one file per page
    _app.tsx      # App wrapper with AuthProvider
    _legacy/      # Archived placeholder pages (not routed, do not delete)
    dashboard/    # Role dashboards
    loans/        # Pipeline table + loan detail
    borrower/     # Borrower application flow
  components/
    app/          # Shell: AppLayout, Sidebar, TopHeader, ProtectedRoute
    dashboard/    # Dashboard cards, grids, status lists
    loans/        # Pipeline table, loan detail, charts, KPIs
    charts/       # Recharts wrappers (StatusCount, StatusAmount, Channel, Trend)
    feedback/     # LoadingSpinner, EmptyState, ErrorState, skeletons
    Notifications/ # Reserved
    ui/           # shadcn/ui primitives (not yet set up — see below)
  hooks/          # Data-fetching hooks — useAuth, useLoans, useLoan
  services/       # apiClient.ts (real fetch wrapper), loanService.ts (mock → real swap point)
  state/          # auth.tsx — React Context + useSyncExternalStore for cross-tab auth
  types/          # auth.ts, loan.ts, dashboard.ts, api.ts (backend response shapes)
  lib/            # utils.ts — cn(), formatCurrency(), formatDate(), formatPercent()
  data/           # mockLoans.ts, mockDashboard.ts, pipelineAnalytics.ts
  styles/         # globals.css — design system, CSS variables, layout
```

**Auth (current)**: Mock auth stored in localStorage. Role → hardcoded user via `authService.ts`. **Not yet wired to real JWT.**

**Data fetching (current)**: All services return mock data. `loanService.ts` is the swap point — replace its internals with `apiClient.ts` calls when ready to go live.

**Target data flow** (once JWT is wired):
```
Login form → POST /auth/login → JWT stored in memory/cookie
→ apiClient.ts injects Bearer header
→ useLoans / useLoan hooks call loanService.ts
→ loanService.ts calls apiClient.ts
→ FastAPI returns typed responses
→ types/api.ts shapes the data
```

---

## Adding new features

**New API endpoint:**
1. Add Pydantic schema in `schemas/<domain>_schema.py`
2. Add route to `api/v1/<domain>.py` — use `Depends(get_audited_db)` for writes, `Depends(get_db)` for reads
3. Implement logic in `services/<domain>_repo.py`
4. Return `<Domain>Out` schema
5. Mirror the response shape in `src/frontend/src/types/api.ts`

**New database table:**
1. Create `db/migrations/<next_number>_<name>.sql`
2. Add SQLAlchemy model in `models/`
3. Run `scripts/db_migrate.sh`
4. If the table needs auditing, attach `log_audit_event()` trigger (add table name to `_LOAN_ID_PK` array in trigger function if PK is `loan_id` not `id`)

**New frontend page:**
1. Add file to `src/pages/<domain>/index.tsx` (or `[id].tsx` for detail)
2. Wrap with `<AppLayout allowedRoles={[...]}>` for auth guard
3. Add hook in `src/hooks/` if it fetches data
4. Add route to sidebar nav in `components/app/Sidebar.tsx`

---

## Key conventions

**Backend:**
- Service files use suffix `_repo.py` even though they contain service/business logic
- Logger name: `origina_backend` (configured in `core/logging.py`)
- API versioned under `/api/v1/` — all new routes go there
- `tenant_id` is never accepted from request body — always from `current_user.tenant_id`
- S3 is the document storage backend — out of scope until core loan flow is working
- `bcrypt==4.0.1` is pinned in requirements.txt — passlib is incompatible with bcrypt 4.1+ (the `__about__` attribute was removed)

**Frontend:**
- Import with `@/*` alias (maps to `src/frontend/src/`)
- Hooks live in `src/hooks/` — not co-located in components
- API response types live in `src/types/api.ts` — keep in sync with backend schemas
- `src/lib/utils.ts` provides `cn()`, `formatCurrency()`, `formatDate()`, `formatPercent()`
- Auth is mock until backend JWT is wired — see `state/auth.tsx`
- Legacy pages are archived under `pages/_legacy/` — not routed, kept for reference

**shadcn/ui setup (not yet done):**
```bash
cd src/frontend
npm install clsx tailwind-merge         # required for cn() in lib/utils.ts
npx shadcn@latest init                  # scaffolds components/ui/ properly
```
The `@shadcn/ui` package currently in package.json (`v0.0.4`) is a dummy — remove it after running the above.

---

## What to review before next feature push

1. **`loans.status` column type** — live DB is `text`, should be `loan_status` enum. Status transitions (Sprint 3) work today; enum migration is housekeeping.
2. **CORS** — backend uses `allow_origins=["*"]`. Lock to `http://localhost:3000` in dev and real domain in prod before any deployment.
3. **JWT secret** — `JWT_SECRET_KEY` in `core/config.py` must be rotated from the dev default before staging/prod.
4. **Bootstrap user** — re-run `scripts/bootstrap_user.py` if login fails; the hash may be stale.
5. **Test-schema trigger install** — Sprint 3 added inline `log_audit_event()` install in `tests/backend/conftest.py`. A migration-based test runner would be cleaner; tracked for Sprint 5.

## Sprint status

- **Sprint 3 (Full Workspace) — ✅ Complete (2026-07-09)**: notes, audit log, status transitions, underwriting panels, documents all wired end-to-end. See `docs/sprints/sprint-3-full-workspace.md`.
- **Sprint 4 (Manager Layer) — ✅ Complete (2026-07-09)**: pipeline assignee JOIN + filters, analytics date-filter bug fixes (qualified columns, `= ANY(:param)`, list validator), `/dashboard/manager` with `TeamKPICard` grid, `domain_events` outbox + dispatcher + SMTP email notifications. See `docs/sprints/sprint-4-manager-layer.md`.
- **Sprint 5 (Production Hardening) — next**: httpOnly cookie auth + rate limiting on `/auth/login`, GitHub Actions CI on every PR, IT-admin tenant onboarding flow.

## Next features to build (priority order)

Per Sprint 5 spec (`docs/sprints/sprint-5-build-spec.md`):

0. **Lint cleanup** — `npm run lint` reports 22 problems (9 errors, 13 warnings) carried across Sprints 3-4 in 11 files. Full inventory in `docs/CURRENT_SPRINT.md` Phase 5.0. Sprint 5.0 owns these so CI can gate the build cleanly.
1. **httpOnly cookie auth** — `POST /auth/login` sets `origina_token` cookie (HttpOnly, SameSite=Lax, Secure off in local); `apiClient.ts` stops injecting `Authorization`; `POST /auth/logout` clears the cookie. XSS can no longer read the session.
2. **Rate limiting on `/auth/login`** — e.g., 5 failures / IP / minute → 429; protects against brute force.
3. **GitHub Actions CI** — `.github/workflows/ci.yml` runs `./scripts/run_tests.sh` on every PR; backend coverage gate (`--cov-fail-under=70` on `app/api`) and condition-lifecycle gate (`--cov-fail-under=90`) enforced.
4. **Migration-based test runner** — replaces inline trigger install in `tests/backend/conftest.py`; runs numbered migrations from `db/migrations/` so test schema is always in sync with prod.
5. **Multi-tenant onboarding** — IT admin can create tenant + bootstrap settings + onboard first user from `pages/admin/tenants.tsx` (or `scripts/bootstrap_tenant.py` CLI).

## Areas to optimize

| Area | What to do |
|---|---|
| Backend list endpoints | Add `skip: int = 0, limit: int = 50` query params; return `{"items": [...], "total": n}` |
| Frontend data fetching | Add `@tanstack/react-query` when wiring real API — caching, background refetch, deduplication |
| `loans.status` type | `ALTER TABLE loans ALTER COLUMN status TYPE loan_status USING status::loan_status` |
| Error responses | Standardize to `{"detail": "...", "code": "..."}` via FastAPI exception handler |
| `components/ui/` | Empty until `npx shadcn@latest init` is run; all shared primitives live here after |
| React Query / SWR | No server-state caching yet — add before wiring live API to avoid waterfall fetches |
