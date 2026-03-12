# Origina LOS - AI Agent Coding Guide

## Project Overview
Origina is a Non-QM (Non-Qualified Mortgage) Loan Origination System (LOS) with a Python/FastAPI backend and PostgreSQL database. The system manages the complete loan lifecycle with workflows, RBAC, document management, and eligibility logic.

## Architecture

### Core Stack
- **Backend**: FastAPI (Python 3.11+) with SQLAlchemy ORM
- **Database**: PostgreSQL with Alembic migrations
- **Auth**: JWT tokens with Role-Based Access Control (RBAC)
- **Documents**: S3 integration for document storage
- **Containers**: Docker Compose (PostgreSQL service defined)

### Key Structural Patterns

#### Database Design (`db/` directory)
- **Migrations** (`db/migrations/`): Sequential SQL migrations (001_extensions → 101_borrowers)
  - Start with extensions (001), conditions (002), seed data (003)
  - Core tables: tenants (010), users/RBAC (020), types (030), parties (040), loans (050), properties (060)
  - Related: documents (080), decisions (090), audit snapshots (100), borrowers (101)
- **Functions** (`db/functions/`): SQL functions organized by domain (audit/, util/, workflow/)
- **Views** (`db/views/`): dashboards/ and reporting/ subdirectories for analytics
- **Triggers & Seeds**: Business logic and initial data

#### Backend Clean Architecture (`src/backend/app/`)
```
app/
├── core/          # Configuration, DB, auth, logging, RBAC
├── api/v1/        # API endpoints (routers)
├── services/      # Business logic layer (currently named *_repo.py)
├── repositories/  # Data access layer
├── models/        # SQLAlchemy ORM models
├── schemas/       # Pydantic request/response validation
├── security/      # JWT, permissions, authentication
└── utils/         # Helper functions
```

**Key Files**:
- `core/db.py`: SQLAlchemy engine & session factory with `get_db()` dependency
- `core/config.py`: Configuration management (APP_NAME="Origina Backend Service")
- `core/main.py`: FastAPI app initialization with health check endpoint
- `core/logging.py`: Logger configured as "origina_backend"

#### API Endpoint Pattern
Routes use FastAPI dependency injection for database sessions:
```python
from fastapi import APIRouter, Depends
from app.core.db import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/endpoint")
def read_endpoint(db: Session = Depends(get_db)):
    # db is automatically injected
    pass
```

### Data Flow
1. **Request** → API Router (v1 endpoints)
2. **Dependency Injection** → Database session via `get_db()`
3. **Service/Repository** → Business logic & data access
4. **Model** → SQLAlchemy ORM object mapping
5. **Schema** → Pydantic validation for responses

## Developer Workflows

### Database
```bash
# Initialize database (assumes Docker container running)
scripts/db_init.sh

# Run migrations
scripts/db_migrate.sh

# Reset database (dev only)
scripts/db_reset.sh
```

**Connection Details** (from docker-compose.yml):
- Host: localhost
- Port: 5432
- User: origina
- Password: origina123
- Database: originadb

### Python Environment
- Virtual environments are in `src/backend/` subdirectories (#/, create/, environment/)
- Check [src/backend/app/core/requirements.md](src/backend/app/core/requirements.md) for layer-1 requirements (auth, RBAC, logging)

## Project-Specific Conventions

### RBAC Implementation
- Defined in Layer 1 requirements (core/requirements.md line 153+)
- JWT authentication required for protected endpoints
- Role validation in API decorators (see `api/v1/` pattern)
- Scopes/permissions managed in `security/` module

### Naming Conventions
- Service files named `*_repo.py` (misnomer—actually services, not repositories)
  - `document_repo.py`, `loan_repo.py`, `user_repo.py`
- Database schema follows lowercase with underscores (`loan_status_events`, `user_parties`)
- API routes versioned (v1) in `api/v1/` directory

### Loan-Related Tables & Workflow
Core loan tables (from migrations):
- `loans` (050) - Main loan record
- `loan_status_events` (073) - Status transitions
- `borrowers` (101) - Borrower details
- `properties` (060) - Property information
- `exceptions` (070) - Exception handling
- `tasks` (071) - Workflow tasks
- `notes` (072) - Loan notes
- `documents` (080) - Associated documents

Workflow state is managed via `loan_status_events` table; trace status changes there.

## Critical Integration Points

### External Systems
- **S3 Document Storage**: Used by document_repo.py (credentials in config)
- **Plaid Integration**: Requirements in [docs/01-Business-Requirements/plaid-requirements.md](docs/01-Business-Requirements/plaid-requirements.md)

### Multi-Tenant Architecture
- `tenants` table (010) is foundational
- User → Tenant relationships managed in users_rbac (020)
- Ensure tenant context in queries (critical for data isolation)

## Common Development Tasks

**Add new loan endpoint**:
1. Define schema in `schemas/loan_schema.py`
2. Create route in `api/v1/loans.py` using `Depends(get_db)`
3. Implement business logic in `services/loan_repo.py`
4. Query via repository layer accessing models
5. Return Pydantic schema response

**Add new database table**:
1. Create migration file in `db/migrations/` with next sequence number
2. Include both CREATE TABLE and any indexes/constraints
3. Update seed data if needed in `db/seeds/`
4. Create SQLAlchemy model in `models/`
5. Run `scripts/db_migrate.sh` to apply

**Audit Logging**:
- Audit functions in `db/functions/audit/`
- Snapshots stored in `audit_snapshots` (100)
- Check triggers for auto-logging patterns

## Known Gaps & TODO Areas
- Frontend mentioned in workspace structure but not present in current repo
- Services layer partially stubbed (loan_repo.py, document_repo.py empty)
- No test suite found (tests/ contains JS concept files, not unit tests)
- Repositories directory exists but structure unclear

## Documentation Reference
- Architecture overview: [docs/08-Architecture/](docs/08-Architecture/)
- Business requirements: [docs/01-Business-Requirements/](docs/01-Business-Requirements/)
- API specs: [docs/10-API-Specs/](docs/10-API-Specs/)
- Loan cycle workflow: [docs/LoanCycleWorkflow.md](docs/LoanCycleWorkflow.md)
