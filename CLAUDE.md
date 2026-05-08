# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Origina is a Non-QM (Non-Qualified Mortgage) Loan Origination System (LOS) and Third Party Origination (TPO) platform. Backend is FastAPI/Python, database is PostgreSQL, frontend is Next.js/TypeScript.

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
npm run dev     # http://localhost:3000
npm run lint    # ESLint
npm run build   # Production build
```

### Database

```bash
docker-compose up -d          # Start PostgreSQL (localhost:5432, db: originadb, user: origina, pass: origina123)
scripts/db_init.sh            # Initialize schema (runs all db/migrations/*.sql in order)
scripts/db_migrate.sh         # Apply Alembic migrations
scripts/db_reset.sh           # Reset database (dev only)
alembic upgrade head          # Alembic migration directly
```

### Python environment

```bash
cd src/backend
pip install -r ../../requirements.txt
```

No backend linter is configured. No test suite exists yet (`tests/` contains JS concept files, not unit tests).

## Architecture

### Backend (`src/backend/app/`)

Clean layered architecture:

| Layer | Path | Role |
|---|---|---|
| API | `api/v1/` | FastAPI routers, one file per domain |
| Services | `services/*_repo.py` | Business logic (named `*_repo.py` by convention — they are services, not repositories) |
| Repositories | `repositories/` | Data access (nascent) |
| Models | `models/` | SQLAlchemy ORM models |
| Schemas | `schemas/` | Pydantic request/response validation |
| Security | `security/` | JWT auth, RBAC, role definitions |
| Core | `core/` | Config, DB session factory, logging, app factory |

**Entry points**: `core/main.py` creates the FastAPI app and registers routers. `main.py` at the app root is a convenience re-export.

**DB session**: All endpoints get a `Session` via `Depends(get_db)` from `core/db.py`. Never instantiate sessions directly.

**Base model**: All ORM models inherit from `BaseModel` in `models/base.py`, which provides UUID primary key, `created_at`/`updated_at` timestamps, and `tenant_id` for multi-tenancy. Every query must scope to `tenant_id`.

**Schemas**: Pydantic schemas use `ConfigDict(from_attributes=True)` for ORM compatibility. The pattern is `<Domain>Base` → `<Domain>Create` / `<Domain>Update` → `<Domain>Out`.

### Database (`db/`)

Raw SQL migrations live in `db/migrations/` with sequential numbering (001–101). These are separate from Alembic — `scripts/db_init.sh` runs them directly against PostgreSQL. Alembic in `migrations/` tracks schema version separately.

Domain grouping in migrations:
- 010 tenants → 020 users/RBAC → 030 types → 040 parties → 050 loans → 060 properties
- 070–073 workflow (exceptions, tasks, notes, loan_status_events)
- 080 documents → 090 decisions → 100 audit snapshots → 101 borrowers

`db/functions/`, `db/triggers/`, and `db/views/` hold SQL stored logic. Audit logging is handled by triggers using functions in `db/functions/audit/`; snapshots go to `audit_snapshots`.

### Loan workflow

Status transitions are tracked in `loan_status_events` (not in-column on `loans`). The canonical status progression is:
`new_draft → submitted → conditions_review → approved → funded → closed`

Conditions have their own lifecycle: `open → submitted → cleared / waived / rejected`.

### Multi-tenancy

`tenants` is the root table. Every model carries `tenant_id`. Data isolation must be enforced at the query level — always filter by `tenant_id` when reading or writing domain data.

### Frontend (`src/frontend/`)

Next.js app with TypeScript, Tailwind CSS 4, and shadcn/ui components. Standard Next.js page-router structure under `src/pages/`. API calls go through `src/services/`.

## Adding new features

**New API endpoint**:
1. Add Pydantic schema in `schemas/<domain>_schema.py`
2. Add route to `api/v1/<domain>.py` using `Depends(get_db)`
3. Implement logic in `services/<domain>_repo.py`
4. Return `<Domain>Out` schema

**New database table**:
1. Create `db/migrations/<next_number>_<name>.sql`
2. Add SQLAlchemy model in `models/`
3. Run `scripts/db_migrate.sh`

## Key conventions

- Service files use the suffix `_repo.py` even though they contain service/business logic
- Logger name: `origina_backend` (configured in `core/logging.py`)
- API is versioned under `/api/v1/`; all new routes go there
- S3 is the document storage backend (credentials via config) and is current out of scope before we have a working application
- No AI/ML features — this is intentionally out of scope
