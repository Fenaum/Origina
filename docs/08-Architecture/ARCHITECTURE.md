# Origina LOS — Architecture Reference

This document captures the key architectural decisions, patterns, and conventions that define how Origina is built. Read this before making changes to avoid breaking established invariants.

---

## System Overview

```
Browser
  └── Next.js 16 (page router, TypeScript strict)
        ├── Auth state (localStorage JWT)
        ├── Zustand stores (pipeline prefs, intake, recent loans, submission)
        └── fetch() via apiClient.ts → loanService.ts

FastAPI / Python
  ├── 14 routers, 82 routes, all under /api/v1/
  ├── JWT auth (python-jose) + RBAC (require_roles dependency)
  ├── SQLAlchemy 2.0 ORM (session via Depends(get_db))
  └── PostgreSQL 15 (Docker)

PostgreSQL
  ├── 109 migrations (raw SQL, not Alembic)
  ├── Enum types, LATERAL JOINs, partial indexes
  ├── Audit triggers on 7 tables
  └── Multi-tenant (tenant_id on every table)
```

---

## Backend Architecture

### Layer Structure

| Layer | Path | Role |
|---|---|---|
| API | `src/backend/app/api/v1/` | FastAPI routers — one file per domain |
| Services | `src/backend/app/services/*_repo.py` | Business logic (named `*_repo.py` by convention) |
| Models | `src/backend/app/models/` | SQLAlchemy ORM models |
| Schemas | `src/backend/app/schemas/` | Pydantic request/response validation |
| Security | `src/backend/app/security/` | JWT decode, RBAC, role constants |
| Core | `src/backend/app/core/` | Config, DB session factory, logging, app factory |

### Entry Point
`core/main.py` creates the FastAPI app and registers all 14 routers.

### Session Management
- **Read endpoints:** `Depends(get_db)` — standard SQLAlchemy session
- **Write endpoints:** `Depends(get_audited_db)` — executes `SET LOCAL app.current_user_id = :uid` before any DML so audit triggers know the actor. Scoped to the transaction, clears on commit/rollback.

### Base Models
- `BaseModel` — mutable tables: UUID PK, `created_at`, `updated_at`, `tenant_id`
- `AppendOnlyModel` — event/log tables: UUID PK, `created_at` only
- Satellite tables (`loan_financials`, `loan_terms`) use `loan_id` as PK+FK to enforce 1:1 at the schema level

### Auth Flow
```
POST /api/v1/auth/login (OAuth2PasswordRequestForm)
  → bcrypt verify password
  → returns {access_token, token_type}

get_current_user (FastAPI dependency)
  → decodes JWT
  → fetches User ORM object
  → checks is_active

require_roles(*allowed) (dependency factory)
  → per-route RBAC
```

### Role Constants (must match `roles` table)
```python
LOAN_OFFICER     = "loan_officer"
PROCESSOR        = "loan_processor"
UNDERWRITER      = "underwriter"
ACCOUNT_MANAGER  = "account_manager"
IT_ADMIN         = "it_admin"
```

### Multi-tenancy
Every model carries `tenant_id`. Isolation is enforced at query level. `tenant_id` is **never** accepted from request body — always derived from `current_user.tenant_id`.

---

## Database Architecture

### Migration Strategy
Raw SQL files in `db/migrations/` are the schema source of truth. `scripts/db_migrate.sh` tracks applied files in `schema_migrations` and runs each in its own transaction.

**Do not use `Base.metadata.create_all()`** — it cannot manage PostgreSQL enum types, triggers, or partial indexes.

### Migration Number Sequence
```
010  tenants
020  users / RBAC
030  enum types
040  parties
050  loans (header)
055  conditions
060  properties
070  exceptions
071  tasks
072  notes
073  loan_status_events
080  documents
090  decisions
100  audit snapshots
101  borrowers
102–109  hardening (audit columns, check constraints, indexes, loan split, trigger fix)
110  borrower intake sessions
```

### Loan Split Pattern
`loans` table = header fields only.
- `loan_financials` (`loan_id` PK) = financial amounts
- `loan_terms` (`loan_id` PK) = rate and term structure

Always insert all three atomically when creating a loan.

### Audit Triggers
Fire AFTER INSERT/UPDATE/DELETE on: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`.

Trigger function `log_audit_event()` reads actor from `app.current_user_id` (set by `get_audited_db`), writes diff to `audit_log`. Tables using `loan_id` as PK are listed in `_LOAN_ID_PK` array inside the function.

### Pipeline Query Design
`GET /api/v1/loans/pipeline` uses a single SQL query with LATERAL JOINs for borrower name, property state, and conditions counts. This avoids N+1 at 200+ loans.

### Known Schema Debt
- `loans.status` is `text` in some environments (should be `loan_status` enum — migration pending)
- `loans.purpose` uses legacy check constraint (should align with `loan_purpose` enum)
- All list endpoints return unbounded results — need `skip`/`limit` pagination before scaling

---

## Frontend Architecture

### Stack
- Next.js 16 (page router, not App Router)
- TypeScript strict mode
- Tailwind CSS v4
- Zustand 5 with `persist` middleware
- Recharts for data visualization

### Directory Structure
```
src/
  pages/             Next.js routes
    _app.tsx         AuthProvider wrapper
    _legacy/         Archived placeholder pages (do not route, do not delete)
    analytics/       Analytics module
    borrower/        Intake + application flow
    dashboard/       Role dashboards
    loans/           Pipeline + loan workspace
    login.tsx
  components/
    app/             Shell: AppLayout, LoanWorkspaceLayout, Sidebar, TopHeader, ProtectedRoute
    borrower/        Intake UI: IntakeShell, QuestionCard, questions/, results/, handoff/
    charts/          Recharts wrappers (5 chart types)
    dashboard/       KPI cards, PageHeader
    feedback/        LoadingSpinner, EmptyState, ErrorState, skeletons
    loans/           Pipeline workspace, Loan workspace shell, detail
      pipeline/      PipelineToolbar, PipelineKpis, PipelineGrid, PipelineFilterPanel
      workspace/     WorkspaceHome, WorkspacePlaceholder, workspaceSections.ts
  hooks/             useAuth, useLoans, useLoan — data-fetching hooks
  services/          apiClient.ts (real fetch), loanService.ts (mock → real swap point)
  state/             auth.tsx, pipelineStore.ts, recentLoansStore.ts
  types/             auth.ts, loan.ts, dashboard.ts, api.ts
  data/              pipelineAnalytics.ts, pipelineFilters.ts, questions.ts, programs.ts, mockLoans.ts
  lib/               utils.ts (cn, formatCurrency, formatDate, formatPercent)
  styles/            globals.css (design system + all component CSS)
```

### Layout System
Two layout components:
- `AppLayout` — Sidebar + TopHeader + `page-content` (padded). Used by most pages.
- `LoanWorkspaceLayout` — Sidebar only, no TopHeader. Used by loan file pages. The loan's own topbar serves as the page header.

The pipeline workspace uses `AppLayout` but overrides its padding via `.page-content:has(.pipeline-workspace)` (CSS `:has()` selector).

### State Management

| Store | Storage | Purpose |
|---|---|---|
| `auth.tsx` | localStorage | JWT token, current user |
| `pipelineStore.ts` | localStorage (`origina.pipeline.v1`) | Sort, columns, user views |
| `recentLoansStore.ts` | localStorage (`origina.recent-loans`) | Last 5 viewed loan files |
| `intakeStore.ts` | sessionStorage | Intake answers, visited questions |
| `submissionStore.ts` | localStorage | Loan submission drafts |

**Critical SSN invariant:** `submissionStore.ts` `partialize` function strips `borrowers[].ssn` before writing to localStorage. SSN lives in Zustand memory only during the session.

### Data Flow (current)
```
Login → POST /auth/login → JWT in localStorage
  → apiClient.ts injects Bearer header
  → loanService.ts calls apiClient.ts (real endpoint)
  → useLoans / useLoan hooks return data
  → Components render

Pipeline: all 202 loans loaded once → client-side filter + sort via pipelineFilters.ts
Intake: anonymous → POST /intake/session → POST /intake/answers → POST /intake/rank → POST /intake/handoff
```

### Navigation Conventions
- Pipeline sections: `?section=xxx` query param (shallow push)
- Loan workspace sections: same pattern, `isWorkspaceSection()` guard
- Sidebar: app-level links only — no loan-file section links in the sidebar

---

## Key Architectural Decisions

### 1. Raw SQL migrations, not Alembic
The live DB was initialized outside the migration runner. Alembic and raw SQL would conflict at PostgreSQL enum types, triggers, and partial indexes. All schema changes go in numbered `.sql` files.

### 2. Service files named `*_repo.py`
Convention from early project setup. They contain service/business logic, not repository pattern code. Do not rename.

### 3. Loan status event sourcing
`loan_status_events` (append-only) tracks every transition. `loans.status` is the current state. Both must be updated atomically on every status change.

### 4. LATERAL JOINs on pipeline query
ORM approach would require per-loan queries for borrowers and conditions. At 200+ loans this creates N+1. One raw SQL query with LATERALs eliminates it.

### 5. JWT in localStorage (not httpOnly cookie)
Next.js page router makes server-side httpOnly cookie auth complex. localStorage is acceptable for demo/dev stage. Must switch before production.

### 6. SSN never in localStorage
Explicit security invariant. `partialize` in `submissionStore.ts` strips SSN before any persist write. Cleared on hydration, must be re-entered.

### 7. Built-in vs user pipeline views
`BUILT_IN_VIEWS` are defined in code (5 default views). `userViews` are persisted to localStorage. On each page load, built-ins are merged from code — so code updates to built-in views are reflected immediately without requiring a localStorage clear.

### 8. Borrower intake uses sessionStorage
Intake answers are pre-application. SessionStorage scopes data to the tab and clears when it closes. Intentional privacy decision.

### 9. `_legacy/` pages are not routed but are not deleted
They serve as a reference for domain vocabulary, field names, and UI patterns from an earlier design phase.

---

## Import Conventions

- All frontend imports use `@/*` alias (maps to `src/frontend/src/`)
- API response types live in `src/types/api.ts` — kept in sync with backend Pydantic schemas
- Hooks live in `src/hooks/` — never co-located in components
- Shared utilities: `src/lib/utils.ts` (`cn()`, `formatCurrency()`, `formatDate()`, `formatPercent()`)

---

## Adding New Features — Checklist

### New API endpoint
1. Add Pydantic schema in `schemas/<domain>_schema.py`
2. Add route to `api/v1/<domain>.py` — use `get_audited_db` for writes, `get_db` for reads
3. Implement logic in `services/<domain>_repo.py`
4. Return `<Domain>Out` schema
5. Mirror shape in `src/frontend/src/types/api.ts`

### New database table
1. Create `db/migrations/<next_number>_<name>.sql`
2. Add SQLAlchemy model in `models/`
3. Run `scripts/db_migrate.sh`
4. If audited: attach `log_audit_event()` trigger; add to `_LOAN_ID_PK` if PK is `loan_id`

### New frontend page
1. Add file to `src/pages/<domain>/index.tsx` (or `[id].tsx`)
2. Wrap with `<AppLayout allowedRoles={[...]}>` for auth guard
3. Add hook in `src/hooks/` if data-fetching
4. Add route to `components/app/Sidebar.tsx`
