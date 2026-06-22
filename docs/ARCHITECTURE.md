# Origina LOS — Architecture Reference

Authoritative source of truth for the current system architecture. Read before making structural changes.

> **Cross-links:** [DECISIONS.md](DECISIONS.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md) | [ROADMAP.md](ROADMAP.md) | [DATA_DICTIONARY](09-Data-Dictionary/DATA_DICTIONARY.md)
>
> **Supersedes:** `docs/08-Architecture/ARCHITECTURE.md` (kept for historical reference)

---

## System Overview

```
Browser (Next.js 16 — page router, TypeScript strict)
  ├── Auth: JWT in localStorage → apiClient.ts injects Bearer header
  ├── Zustand stores: pipeline prefs, intake, recent loans, submission draft
  └── fetch() via apiClient.ts → service layer → hooks → components

FastAPI / Python (src/backend/)
  ├── 18+ routers, 100+ routes, all under /api/v1/
  ├── JWT auth (python-jose) + RBAC (require_roles dependency factory)
  ├── SQLAlchemy 2.0 ORM (session via Depends(get_db) or get_audited_db)
  └── PostgreSQL 15 (Docker in dev, AWS RDS in prod)

PostgreSQL
  ├── 125 migrations (raw SQL, tracked by schema_migrations table)
  ├── TEXT + CHECK constraints (no PostgreSQL ENUM columns remain)
  ├── Audit triggers on 8 tables
  ├── controlled_value_sets + controlled_values (tenant-configurable metadata)
  └── Multi-tenant: tenant_id on every table, enforced at query level
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
`core/main.py` creates the FastAPI app and registers all routers under `/api/v1/`.

### Session Management
- **Read endpoints:** `Depends(get_db)` — standard SQLAlchemy session
- **Write endpoints:** `Depends(get_audited_db)` — executes `SET LOCAL app.current_user_id = :uid` before any DML so audit triggers know the actor; scoped to the transaction, clears on commit/rollback

### Base Models
- `BaseModel` — mutable tables: UUID PK, `created_at`, `updated_at`, `tenant_id`
- `AppendOnlyModel` — event/log tables: UUID PK, `created_at` only (no `updated_at`)
- Satellite tables (`loan_financials`, `loan_terms`) use `loan_id` as PK+FK — enforces 1:1 at schema level

### Plain Class Constants (not Python Enums)
All status/type constants use plain classes with string values and frozensets:
```python
class LoanStatus:
    NEW_DRAFT  = "new_draft"
    SUBMITTED  = "submitted"
    TERMINAL: frozenset[str] = frozenset({"denied", "withdrawn", "cancelled", "archived"})
    ALL: frozenset[str] = frozenset({...all 12...})
```
This pattern applies to: `LoanStatus`, `LoanPurpose`, `LoanPartyRole`, `ConditionStatus`, `TaskStatus`, `TaskPriority`, `BorrowerType`, `BorrowerRelationship`, `BorrowerIncomeType`, `PartyType`, `ExceptionStatus`, `ExceptionSeverity`.

### Schemas
Pydantic schemas use `ConfigDict(from_attributes=True)` for ORM compatibility.
Pattern: `<Domain>Base` → `<Domain>Create` / `<Domain>Update` → `<Domain>Out`

### Role Constants (must match `roles` table values)
```python
LOAN_OFFICER    = "loan_officer"
PROCESSOR       = "loan_processor"
UNDERWRITER     = "underwriter"
ACCOUNT_MANAGER = "account_manager"
IT_ADMIN        = "it_admin"
```

### Multi-tenancy
`tenant_id` is on every table. Isolation is enforced at query level. `tenant_id` is **never** accepted from request body — always derived from `current_user.tenant_id` (JWT payload).

---

## Authentication and Authorization

### Auth Flow
```
POST /api/v1/auth/login (OAuth2PasswordRequestForm)
  → bcrypt verify password (bcrypt==4.0.1 pinned — passlib incompatible with 4.1+)
  → returns {access_token, token_type}

get_current_user (FastAPI dependency)
  → decodes JWT
  → fetches User ORM object
  → checks is_active

require_roles(*allowed) (dependency factory)
  → per-route RBAC, raises 403 if role not in allowed set
```

### Frontend Auth
JWT stored in localStorage under `origina.token`. `apiClient.ts` reads this and injects `Authorization: Bearer <token>` on every request. On app mount, `useAuth` hook reads token and derives user context.

**Security note:** localStorage JWT is acceptable for dev/demo. Must migrate to httpOnly cookies before production deployment. See [DECISIONS.md](DECISIONS.md) and [ROADMAP.md](ROADMAP.md).

---

## Database Architecture

### Migration Strategy
Raw SQL files in `db/migrations/` are the schema source of truth. `scripts/db_migrate.sh` tracks applied files in `schema_migrations` and runs each file in its own `BEGIN/COMMIT` transaction. Never use `Base.metadata.create_all()`.

### Migration Number Sequence
```
010  tenants
020  users / RBAC
030  enum types (defined but all columns now TEXT — see 122–125)
040  parties
041  user_parties
050  loans (header)
055  conditions
060  properties
070  exceptions (initial — loan_id was NOT NULL)
071  tasks
072  notes
073  loan_status_events
080  documents
090  decisions/decisioning
100  audit snapshots
101  borrowers + addresses
102–109  hardening (audit columns, check constraints, indexes, loan split, trigger fix)
110  borrower intake (sessions, answers, handoffs)
111  condition enhancements
112  documents v2
113  property details
114  appraisal
115  credit reports
116  escrow
117  title orders
118–121  exceptions v2 (nullable loan_id, structured fields, events/comments, decisions)
122  loans.status + loan_status_events → TEXT + CHECK (was ENUM)
123  conditions.status, tasks.status/priority → TEXT + CHECK (was ENUM)
124  controlled_value_sets + controlled_values tables (18 sets, 144 seed values)
125  loans.purpose, borrowers.type/income_type/relationship, parties.party_type,
     loan_parties.role → TEXT + CHECK (loan_parties required DROP+ALTER+re-add composite PK)
```

**Current state:** Zero PostgreSQL ENUM columns remain. All domain values are TEXT + CHECK constraint.

### Loan Split Pattern
```
loans              — header: status, purpose, program, assigned_to, dates
loan_financials    — amounts: loan_amount, LTV, FICO, DTI, DSCR  (loan_id PK+FK)
loan_terms         — rate: interest_rate, term_months, lock_days  (loan_id PK+FK)
```
All three rows inserted atomically when creating a loan.

### Controlled Values Architecture
```
controlled_value_sets  (set_code PK, scope, description)
controlled_values      (set_code, tenant_id nullable, code, label, sort_order, is_active, metadata JSONB)
                       UNIQUE NULLS NOT DISTINCT (set_code, tenant_id, code)
```
- `tenant_id IS NULL` = system/global default
- `tenant_id = X` = tenant override, shadows system row at query time
- 18 value sets seeded: loan_status, loan_purpose, loan_program, condition_status, exception_category, exception_type, reason_code, document_type, borrower_type, borrower_relationship, borrower_income_type, party_type, loan_party_role, task_status, task_priority, exception_status, exception_severity, compensating_factor
- API: `GET /api/v1/metadata/values/{set_code}` merges system + tenant rows

### Audit Triggers
`log_audit_event()` trigger fires AFTER INSERT/UPDATE/DELETE on: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`, `exceptions`, `loan_status_events`.

Reads actor from `app.current_user_id` (set by `get_audited_db`). Writes JSON diff to `audit_log`. Tables where PK is `loan_id` (not `id`) are listed in `_LOAN_ID_PK` inside the trigger function.

### Pipeline Query Design
`GET /api/v1/loans/pipeline` uses a single SQL query with LATERAL JOINs for borrower name, property state, and conditions counts. Zero N+1 at any pipeline size.

---

## Event and Audit Architecture

### Dual-Write Status History
Every loan status transition writes to two places atomically:
1. `loans.status` — current state (queryable, indexable for pipeline)
2. `loan_status_events` (append-only) — `from_status`, `to_status`, `actor_user_id`, `reason`, `occurred_at`

### Audit Log
`audit_log` table captures `before` and `after` JSON for every INSERT/UPDATE/DELETE on audited tables. Written by DB trigger (not application code) — cannot be bypassed by the application layer.

### Exception Event Log
`exception_events` (append-only) tracks every action on an exception: creation, status transition, linking to loan, decisions, condition changes. Each event stores `event_type` and a `event_data` JSONB blob for flexible per-event-type payload.

---

## Exception Module Architecture

```
exceptions                     — core record (loan_id nullable for pre-file)
  ├── exception_events         — append-only action log
  ├── exception_comments       — append-only comment thread
  ├── exception_documents      — junction: exceptions ↔ documents
  └── exception_conditions     — conditions attached to approved exceptions
exception_authority_rules      — tenant-configurable approval authority matrix
```

### Exception Lifecycle
```
pre_file (loan_id = NULL)  →  submitted  →  assigned  →  under_review
  →  approved / approved_with_conditions / denied / withdrawn

approved pre-file  →  POST /exceptions/{id}/link-loan  →  loan_file (loan_id set)
```

### Pre-File Exceptions
- Created without a loan (`loan_id = NULL`, `exception_source = "pre_file"`)
- AE/broker submits to get advance approval for a guideline variance
- On loan creation, approved pre-file exceptions can be linked via `POST /exceptions/{id}/link-loan`
- Link sets `loan_id` in-place (conversion model, not copy)
- Accessible via global `/exceptions` page in sidebar (AE and broker roles)
- Surfaced in submission ReviewSummary with "Attach to Loan" button

### Authority Rules
`exception_authority_rules` controls who can approve what severity at what exception type. Enforced in `decide_exception()` service function. Supports `requires_dual_approval` for high-severity variances.

### 25 API Routes
`GET/POST /exceptions/`, `GET/PATCH/DELETE /exceptions/{id}`, workflow actions (submit, assign, start-review, request-info, decide, withdraw, reopen), condition management (list, satisfy, waive), analytics (summary, approver-queue), linking (`POST /exceptions/{id}/link-loan`).

---

## Loan Workspace Architecture

```
/loans/[loanId]?section=<name>
```

### Layout
`LoanWorkspaceLayout` — sidebar only, no global TopHeader. The loan's sticky topbar is the page header.

### Sticky Topbar (always visible)
- Breadcrumb ← Pipeline
- Borrower name + loan number
- Status pill
- Loan amount, program, subject property state

### Section Navigation
Horizontal tab bar with primary sections. Less-used sections in a "More ▾" dropdown. Section is controlled by `?section=` query param (shallow push — no reload).

### Current Sections (13+)
| Group | Sections |
|---|---|
| Primary | Home, Processing, Underwriting, Conditions, Documents, Notes |
| More | Borrower URLA, Parties, Income, Exceptions, Tasks, Appraisal, Credit, Escrow, Title, Audit Log |

### WorkspaceHome
Shows loan summary (8 header fields from `LoanSummary`), open conditions count, document status. Registers the loan in Recent Files (Zustand + localStorage, last 5 loans).

---

## Frontend Architecture

### Stack
- Next.js 16 (page router — not App Router)
- TypeScript strict mode
- Tailwind CSS v4
- Zustand 5 with `persist` + `immer` middleware
- Recharts for data visualization
- CSS design system via variables in `globals.css` (no CSS-in-JS)

### Directory Structure
```
src/
  pages/             Next.js routes
    _app.tsx         AuthProvider wrapper
    _legacy/         Archived placeholder pages (do not route, do not delete)
    analytics/
    borrower/        Intake + application flow
    dashboard/       Role dashboards
    exceptions/      Pre-file exceptions page
    loans/           Pipeline + loan workspace
    login.tsx
  components/
    app/             Shell: AppLayout, LoanWorkspaceLayout, Sidebar, TopHeader
    borrower/        Intake UI
    charts/          Recharts wrappers
    dashboard/       KPI cards, PageHeader
    feedback/        LoadingSpinner, EmptyState, ErrorState, skeletons
    loans/           Pipeline + workspace components
      pipeline/      Toolbar, KPIs, Grid, FilterPanel, action modals
      workspace/     WorkspaceHome, section components, workspaceSections.ts
    submission/      Multi-step loan submission wizard
  hooks/             useAuth, useLoans, useLoan
  services/          apiClient.ts, loanService.ts, submissionService.ts
  state/             auth.tsx, pipelineStore.ts, recentLoansStore.ts
  lib/               utils.ts (cn, formatCurrency, formatDate, formatPercent)
                     exceptionConstants.ts (shared exception UI constants)
  types/             auth.ts, loan.ts, dashboard.ts, api.ts, submission.ts
  data/              pipelineAnalytics.ts, pipelineFilters.ts, questions.ts, mockLoans.ts
  styles/            globals.css (design system + all component CSS)
```

### Layout System
| Layout | Used by | Structure |
|---|---|---|
| `AppLayout` | Most pages | Sidebar + TopHeader + padded content |
| `LoanWorkspaceLayout` | Loan workspace | Sidebar only (loan topbar is the header) |

### State Management

| Store | Storage | Purpose |
|---|---|---|
| `auth.tsx` | localStorage (`origina.token`) | JWT token, current user |
| `pipelineStore.ts` | localStorage (`origina.pipeline.v1`) | Sort, columns, saved views |
| `recentLoansStore.ts` | localStorage (`origina.recent-loans`) | Last 5 viewed loan files |
| `intakeStore.ts` | sessionStorage | Intake answers (cleared on tab close) |
| `submissionStore.ts` | localStorage | Loan submission draft |
| `documentStore.ts` | In-memory | Document upload state (not persisted) |

**SSN invariant:** `submissionStore.ts` `partialize` strips `borrowers[].ssn` before every localStorage write. SSN lives in memory only.

### Data Flow
```
Login → POST /auth/login → JWT in localStorage
  → apiClient.ts injects Bearer header
  → service layer (loanService, submissionService, etc.)
  → hooks (useLoans, useLoan) return typed data
  → components render

Pipeline: all loans loaded once → client-side filter+sort via pipelineFilters.ts
Intake: anonymous → POST /intake/session → /intake/answers → /intake/rank → /intake/handoff
Submission: form state in Zustand → saveDraft (localStorage) → submitLoan (POST /loans/{id}/submit)
```

### Type Conventions
- `src/types/api.ts` — backend response shapes (keep in sync with Pydantic `*Out` schemas)
- `src/types/loan.ts` — pipeline display types (`LoanProgram` includes conventional/other)
- `src/types/submission.ts` — submission wizard types (`LoanProgram` is Non-QM subset only)
- Import alias: `@/*` maps to `src/frontend/src/`

---

## Integration Architecture

### Current Integrations
| System | Status | Notes |
|---|---|---|
| PostgreSQL | Live | Docker in dev, AWS RDS in prod |
| JWT auth | Live | python-jose + bcrypt 4.0.1 (pinned) |
| S3 document storage | Planned | Simulated with setTimeout in dev |
| MISMO XML parsing | Stub | Frontend placeholder, backend not implemented |
| Pricing engine | None | Hardcoded rate scenarios in frontend |
| Email notifications | None | Tables exist, no send mechanism |

### Planned Integrations (see ROADMAP.md)
- AWS S3 for real document upload (presigned URLs)
- Email via SES for handoff notifications, status change alerts
- Plaid-style asset/income verification (Phase 3+)
- eSign / eDisclosures (Phase 3+)

---

## Future Scalability Considerations

### What needs attention before scale

| Item | When | Solution |
|---|---|---|
| Pagination on all list endpoints | Before > 500 loans | `skip`/`limit` params + `total` count in response |
| React Query / SWR | Before live API wire | Server-state caching, background refetch, deduplication |
| JWT → httpOnly cookie | Before production | Server-side session; eliminates XSS token theft vector |
| CORS `allow_origins=["*"]` | Before any external access | Lock to actual frontend domain |
| JWT secret in code | Before staging | Load from environment variable |

### Multi-tenant SaaS scalability
The `controlled_values` architecture was specifically designed for this. Adding a new lender tenant requires:
1. `INSERT INTO tenants`
2. `INSERT INTO users` with `tenant_id`
3. Optionally: `INSERT INTO controlled_values` rows to override labels or add custom values

No migrations, no deploys, no code changes required for tenant customization.

### Database scaling path
- All list queries have partial indexes on `(tenant_id, status)` and similar
- LATERAL JOIN pipeline query scales linearly
- `loan_financials` and `loan_terms` satellite tables allow column-level partitioning if needed
- Audit log will become the largest table — archiving strategy needed at scale (partition by `created_at`)

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
5. If it contains controlled values: add rows to `controlled_value_sets` + `controlled_values` in the migration

### New frontend page
1. Add file to `src/pages/<domain>/index.tsx` (or `[id].tsx`)
2. Wrap with `<AppLayout allowedRoles={[...]}>` for auth guard
3. Add hook in `src/hooks/` if data-fetching
4. Add route to `components/app/Sidebar.tsx` with `roles` array

### New controlled value set
1. Add `INSERT INTO controlled_value_sets` in the migration
2. Add `INSERT INTO controlled_values` seed rows for all initial values
3. Add plain class constants in the relevant model file
4. Update the `CHECK` constraint on the relevant column

---

## Documentation Maintenance Rules

- **Update the Migration Number Sequence table** every time a new migration is applied.
- **Update Current State under Database Architecture** if ENUM count or controlled_values count changes.
- **Update the Sections table** in the Loan Workspace section when sections are added or removed.
- **Cross-reference DECISIONS.md** for the why behind any architectural choice described here.
- This document describes **current implementation only** — future plans belong in [ROADMAP.md](ROADMAP.md).
