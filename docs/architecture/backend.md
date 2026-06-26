# Backend Architecture

> Part of [Architecture Index](README.md)

---

## Layer Structure

| Layer | Path | Role |
|---|---|---|
| API | `src/backend/app/api/v1/` | FastAPI routers — one file per domain |
| Services | `src/backend/app/services/*_repo.py` | Business logic (named `*_repo.py` by convention) |
| Models | `src/backend/app/models/` | SQLAlchemy ORM models |
| Schemas | `src/backend/app/schemas/` | Pydantic request/response validation |
| Security | `src/backend/app/security/` | JWT decode, RBAC, role constants |
| Core | `src/backend/app/core/` | Config, DB session factory, logging, app factory |

**Entry point:** `core/main.py` creates the FastAPI app and registers all routers under `/api/v1/`.

---

## Session Management

- **Read endpoints:** `Depends(get_db)` — standard SQLAlchemy session
- **Write endpoints:** `Depends(get_audited_db)` — executes `SET LOCAL app.current_user_id = :uid` before any DML so audit triggers know the actor; scoped to the transaction, clears on commit/rollback

---

## Base Models

- `BaseModel` — mutable tables: UUID PK, `created_at`, `updated_at`, `tenant_id`
- `AppendOnlyModel` — event/log tables: UUID PK, `created_at` only (no `updated_at`)
- Satellite tables (`loan_financials`, `loan_terms`) use `loan_id` as PK+FK — enforces 1:1 at schema level

---

## Plain Class Constants (not Python Enums)

All status/type constants use plain classes with string values and frozensets:

```python
class LoanStatus:
    NEW_DRAFT  = "new_draft"
    SUBMITTED  = "submitted"
    TERMINAL: frozenset[str] = frozenset({"denied", "withdrawn", "cancelled", "archived"})
    ALL: frozenset[str] = frozenset({...all 12...})
```

This pattern applies to: `LoanStatus`, `LoanPurpose`, `LoanPartyRole`, `ConditionStatus`, `TaskStatus`, `TaskPriority`, `BorrowerType`, `BorrowerRelationship`, `BorrowerIncomeType`, `PartyType`, `ExceptionStatus`, `ExceptionSeverity`.

No `.value` access needed anywhere — `ExceptionStatus.APPROVED == "approved"` directly.

---

## Schemas

Pydantic schemas use `ConfigDict(from_attributes=True)` for ORM compatibility.

Pattern: `<Domain>Base` → `<Domain>Create` / `<Domain>Update` → `<Domain>Out`

---

## Role Constants

Must match values in the `roles` table:

```python
LOAN_OFFICER    = "loan_officer"
PROCESSOR       = "loan_processor"
UNDERWRITER     = "underwriter"
ACCOUNT_MANAGER = "account_manager"
IT_ADMIN        = "it_admin"
```

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

JWT stored in localStorage under `origina.token`. `apiClient.ts` reads this and injects `Authorization: Bearer <token>` on every request. On app mount, `auth.tsx` reads the token and derives user context.

**Security note:** localStorage JWT is acceptable for dev/demo. Must migrate to httpOnly cookies before production deployment. See [DECISIONS.md](../DECISIONS.md) and [ROADMAP.md](../ROADMAP.md).

---

## Multi-Tenancy

`tenant_id` is on every table. Isolation is enforced at query level. `tenant_id` is **never** accepted from request body — always derived from `current_user.tenant_id` (JWT payload). No exception.
