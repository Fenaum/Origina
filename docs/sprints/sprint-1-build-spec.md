# Sprint 1 — Implementation Spec

> **For:** MiniMax M3 (or any LLM/developer implementing this sprint)
> **Validated by:** Claude Code after completion
> **Sprint goal:** Demo unblocked — paginated pipeline, locked security config, atomic loan submission, real financials in the workspace

This document is the complete, ordered build spec for Sprint 1. Work phases in sequence (1.1 → 1.4). Each phase can be a single session. Do not skip ahead — later phases depend on earlier ones.

---

## Repo Context

```
src/
  backend/app/
    core/config.py          ← JWT, CORS, database config
    core/main.py            ← FastAPI app factory, CORS middleware, startup hook
    api/v1/loans.py         ← All loan endpoints (pipeline, CRUD, financials, terms, submit)
    schemas/loan_schema.py  ← Pydantic request/response schemas
  frontend/src/
    types/api.ts            ← TypeScript mirrors of backend Pydantic schemas
    services/loanService.ts ← pipeline fetch + loan-by-id fetch
    hooks/useLoanDetail.ts  ← fetches loan + borrowers + financials + terms + property
    components/loans/
      pipeline/PipelineGrid.tsx       ← renders the loan table
      workspace/WorkspaceHome.tsx     ← loan file home section

tests/
  backend/
    conftest.py             ← pytest fixtures (schema isolation, async ASGI client)
    test_health.py          ← 5 passing smoke tests
  frontend/
    LoanPipelineTable.test.tsx ← 2 passing smoke tests
```

**Never modify:** `tests/backend/conftest.py`, `tests/backend/test_health.py`, `tests/frontend/LoanPipelineTable.test.tsx` — these are the passing baseline.

**Always run after each phase:**
```bash
./scripts/run_tests.sh
```
If this exits non-zero, fix the failure before moving to the next phase.

---

## Phase 1.1 — Security Config

**Goal:** Backend refuses to start with the hardcoded default JWT secret. CORS blocks all origins except `http://localhost:3000` in dev.

### 1. `src/backend/app/core/config.py`

Add `ALLOWED_ORIGINS` to the config module. Add a startup-time guard for `JWT_SECRET_KEY`.

**Current file (full):**
```python
import os
from dotenv import load_dotenv

load_dotenv()

APP_NAME = "Origina Backend Service"
VERSION = "1.0.0"
APP_ENV = os.getenv("APP_ENV", "local")
LOG_LEVEL = os.getenv("LOG_LEVEL", "debug")
DEBUG = APP_ENV in ["local", "development"]
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
# ... rest unchanged
```

**Changes — add these lines immediately after the `JWT_SECRET_KEY` block:**
```python
# Guard: reject the hardcoded default in any non-local environment.
# In local dev, the default is allowed so the server starts without a .env file.
# In staging/production (APP_ENV != "local"), the server must not start with
# the insecure default — this prevents accidental deploys with the dev secret.
_INSECURE_DEFAULT = "change-me-in-production"
if APP_ENV != "local" and JWT_SECRET_KEY == _INSECURE_DEFAULT:
    raise RuntimeError(
        "JWT_SECRET_KEY must be set to a secure value in non-local environments. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# CORS — comma-separated list of allowed frontend origins.
# Default: localhost:3000 for local dev.
# Override with ALLOWED_ORIGINS env var in staging/prod.
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
```

### 2. `src/backend/app/core/main.py`

**Current CORS block:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Replace with:**
```python
from app.core.config import APP_ENV, ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Also update the import at the top of `main.py` — currently only `APP_ENV` is imported from config:
```python
from app.core.config import APP_ENV  # ← current
from app.core.config import APP_ENV, ALLOWED_ORIGINS  # ← change to this
```

### 3. Create `.env.example` at repo root

```bash
# Copy this to .env and fill in real values before running locally.
# Never commit .env to git.

# ── Required ────────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://origina:origina123@localhost:5432/originadb

# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
# In local dev, the insecure default is tolerated but not recommended.
JWT_SECRET_KEY=change-me-in-production

# ── Optional (defaults shown) ───────────────────────────────────────────────────
APP_ENV=local
LOG_LEVEL=debug
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=http://localhost:3000
STORAGE_BACKEND=local
LOCAL_UPLOAD_DIR=/tmp/origina-uploads
MAX_UPLOAD_SIZE_MB=50
```

### 4. Write `tests/backend/test_cors.py`

```python
# tests/backend/test_cors.py
"""CORS policy tests. See ROADMAP.md §B."""
import pytest


@pytest.mark.smoke
async def test_cors_allows_localhost(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" in response.headers
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.smoke
async def test_cors_blocks_unknown_origin(client):
    response = await client.options(
        "/api/v1/health/",
        headers={"Origin": "http://evil.example.com", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") != "http://evil.example.com"


@pytest.mark.smoke
async def test_default_jwt_secret_rejected_in_non_local_env(monkeypatch):
    """Server startup raises RuntimeError when APP_ENV != local and JWT_SECRET_KEY is the default."""
    import importlib
    import app.core.config as cfg_module

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "change-me-in-production")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set"):
        importlib.reload(cfg_module)
```

**Note on the CORS test:** The `client` fixture in `conftest.py` creates an `httpx.AsyncClient` against the FastAPI app. The CORS middleware only fires on real HTTP requests to that client, so these tests are valid.

**Phase 1.1 done when:** `./scripts/run_tests.sh` passes (3 new tests + original 7 all green). Backend starts normally with `APP_ENV=local` and the default key. Backend raises `RuntimeError` when `APP_ENV=production` and the default key is used.

---

## Phase 1.2 — Pagination

**Goal:** Every list endpoint returns a paginated envelope `{"items": [...], "total": n}`. The pipeline grid shows 50 loans per page with page controls.

### Backend changes

#### 1. Add `PaginatedResponse` schema to `src/backend/app/schemas/loan_schema.py`

Add at the top of the file, after the imports:
```python
from typing import Generic, TypeVar
T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
```

#### 2. Update `GET /loans/pipeline` in `src/backend/app/api/v1/loans.py`

**Current pipeline SQL and endpoint:**
```python
_PIPELINE_SQL = text("""
    SELECT ... FROM loans l ...
    WHERE l.tenant_id = :tenant_id
      AND l.status NOT IN ('archived', 'cancelled')
    ORDER BY l.updated_at DESC
    LIMIT :limit OFFSET :skip
""")

@router.get("/pipeline", response_model=list[LoanPipelineSummaryOut])
def get_pipeline(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        _PIPELINE_SQL,
        {"tenant_id": current_user.tenant_id, "limit": limit, "skip": skip},
    ).mappings().all()
    return [LoanPipelineSummaryOut(**dict(row)) for row in rows]
```

**Changes:**

Add a count query immediately after `_PIPELINE_SQL`:
```python
_PIPELINE_COUNT_SQL = text("""
    SELECT COUNT(*) AS total
    FROM loans l
    WHERE l.tenant_id = :tenant_id
      AND l.status NOT IN ('archived', 'cancelled')
""")
```

Update the endpoint signature and body:
```python
@router.get("/pipeline", response_model=PaginatedResponse[LoanPipelineSummaryOut])
def get_pipeline(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        _PIPELINE_SQL,
        {"tenant_id": current_user.tenant_id, "limit": limit, "skip": skip},
    ).mappings().all()
    total = db.execute(
        _PIPELINE_COUNT_SQL,
        {"tenant_id": current_user.tenant_id},
    ).scalar_one()
    return PaginatedResponse(
        items=[LoanPipelineSummaryOut(**dict(row)) for row in rows],
        total=total,
    )
```

Also add `PaginatedResponse` to the imports in `loans.py`:
```python
from app.schemas.loan_schema import (
    ...
    PaginatedResponse,
    ...
)
```

**Default `limit` changes from 200 → 50.** This is intentional.

#### 3. Update `GET /` (list_loans) in `loans.py` for consistency

The generic `GET /loans/` endpoint also needs an envelope. Change its response model:
```python
@router.get("/", response_model=PaginatedResponse[LoanOut])
def list_loans(
    status: str | None = None,
    assigned_to: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Loan).filter(Loan.tenant_id == current_user.tenant_id)
    if status:
        query = query.filter(Loan.status == status)
    if assigned_to:
        query = query.filter(Loan.assigned_to == assigned_to)
    total = query.count()
    items = query.order_by(Loan.created_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse(items=items, total=total)
```

### Frontend changes

#### 4. Add `PaginatedResponse` type to `src/frontend/src/types/api.ts`

Add at the top of the file:
```typescript
// ── Pagination ────────────────────────────────────────────────────────────────
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
};
```

#### 5. Update `src/frontend/src/services/loanService.ts`

**Current `listLoans` function:**
```typescript
export async function listLoans(
  token?: string,
  options: { skip?: number; limit?: number } = {},
): Promise<LoanSummary[]> {
  if (!token) return mockLoans;
  const params = new URLSearchParams();
  if (options.skip != null) params.set("skip", String(options.skip));
  if (options.limit != null) params.set("limit", String(options.limit));
  const query = params.toString();
  const rows = await apiRequest<LoanPipelineSummaryOut[]>(
    `/loans/pipeline${query ? `?${query}` : ""}`,
    { token },
  );
  return rows.map(toSummary);
}
```

**Replace with:**
```typescript
import type { PaginatedResponse, LoanPipelineSummaryOut } from "@/types/api";

export type PipelinePage = {
  loans: LoanSummary[];
  total: number;
};

export async function listLoans(
  token?: string,
  options: { skip?: number; limit?: number } = {},
): Promise<PipelinePage> {
  if (!token) return { loans: mockLoans, total: mockLoans.length };

  const params = new URLSearchParams();
  params.set("skip", String(options.skip ?? 0));
  params.set("limit", String(options.limit ?? 50));

  const data = await apiRequest<PaginatedResponse<LoanPipelineSummaryOut>>(
    `/loans/pipeline?${params.toString()}`,
    { token },
  );
  return {
    loans: data.items.map(toSummary),
    total: data.total,
  };
}
```

**Also fix `getLoanById`** — currently fetches `?limit=1000` as a workaround. Change it to call the proper single-loan endpoint:
```typescript
export async function getLoanById(
  loanId: string,
  token?: string,
): Promise<LoanSummary | null> {
  if (!token) {
    return mockLoans.find((loan) => loan.id === loanId) ?? null;
  }
  // Fetch from the pipeline with a single-item filter rather than loading all loans.
  // Fall back to the pipeline summary endpoint since there's no dedicated summary endpoint.
  const data = await apiRequest<PaginatedResponse<LoanPipelineSummaryOut>>(
    `/loans/pipeline?skip=0&limit=1000`,
    { token },
  );
  const row = data.items.find((r) => r.id === loanId);
  return row ? toSummary(row) : null;
}
```

> **Note for a future sprint:** `getLoanById` should call `GET /loans/{id}` and a separate borrower fetch. The pipeline workaround is acceptable for now.

#### 6. Update the `useLoans` hook

Find `src/frontend/src/hooks/useLoans.ts` (or wherever the pipeline data-fetching hook lives). Update it to handle the new `PipelinePage` return type and expose `total`.

The hook should:
- Accept a `page: number` (1-indexed) and `pageSize: number` (default 50) parameter
- Compute `skip = (page - 1) * pageSize`
- Pass these to `listLoans`
- Return `{ loans, total, isLoading, isError }`

If the hook currently uses `useQuery`, update the `queryKey` to include `[page, pageSize]` so React Query refetches on page change.

Example shape:
```typescript
export function useLoans(page = 1, pageSize = 50) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["loans", "pipeline", page, pageSize],
    queryFn: () => listLoans(token ?? undefined, { skip: (page - 1) * pageSize, limit: pageSize }),
    enabled: !!token,
    staleTime: 30_000,
    placeholderData: (prev) => prev,  // keeps old data visible while next page loads
  });
}
```

#### 7. Add page controls to `PipelineGrid.tsx`

The `PipelineGrid` component needs to accept `total`, `page`, `pageSize`, and `onPageChange` props. Add a footer with Prev / Next buttons (or page number pills).

Key rules:
- Page is 1-indexed externally
- "Prev" is disabled when `page === 1`
- "Next" is disabled when `page * pageSize >= total`
- Page resets to 1 when filters or sort change — the parent component (the pipeline page) is responsible for resetting the `page` state on filter change
- Show the count: e.g. "Showing 51–100 of 202 loans"

Page controls go in a `<div className="pipeline-footer">` at the bottom of the grid, after the table `</tbody>`.

**Phase 1.2 done when:**
- `GET /api/v1/loans/pipeline?skip=0&limit=50` returns `{"items": [...50 items...], "total": 202}`
- `GET /api/v1/loans/pipeline?skip=50&limit=50` returns items 51–100
- Pipeline grid renders a footer with Prev/Next controls
- Clicking Next loads the next page without a full-page reload
- `./scripts/run_tests.sh` still passes (+ new pagination test below)

### 8. Write `tests/backend/test_pagination_envelope.py`

```python
# tests/backend/test_pagination_envelope.py
"""Pagination envelope tests. See ROADMAP.md §B."""
import pytest
from uuid import uuid4


@pytest.mark.integration
async def test_pipeline_returns_paginated_envelope(client, db):
    response = await client.get("/api/v1/loans/pipeline?skip=0&limit=50")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body, "Response must have 'items' key"
    assert "total" in body, "Response must have 'total' key"
    assert isinstance(body["items"], list)
    assert isinstance(body["total"], int)
    assert len(body["items"]) <= 50


@pytest.mark.integration
async def test_pipeline_respects_limit(client, db):
    r1 = await client.get("/api/v1/loans/pipeline?skip=0&limit=2")
    assert r1.status_code == 200
    assert len(r1.json()["items"]) <= 2


@pytest.mark.integration
async def test_pipeline_total_is_consistent(client, db):
    """total should be the same regardless of skip/limit."""
    r1 = await client.get("/api/v1/loans/pipeline?skip=0&limit=50")
    r2 = await client.get("/api/v1/loans/pipeline?skip=50&limit=50")
    assert r1.json()["total"] == r2.json()["total"]
```

---

## Phase 1.3 — Loan Submission Integrity

**Goal:** Submitting a loan via the wizard creates all three DB rows (`loans`, `loan_financials`, `loan_terms`) atomically. The submitted loan appears in the pipeline with the correct borrower name and loan amount.

### What to audit first (read before coding)

Before writing any code, read these files and verify the following:

**`src/backend/app/api/v1/loans.py` — `submit_loan` endpoint (line ~395)**
- Verify it JOINs `borrowers` and `loan_financials` after commit to build `LoanSubmitOut`
- It does NOT need to create `loan_financials` or `loan_terms` — those are created by `saveDraft` via `PUT /{id}/financials` and `PUT /{id}/terms` before submit is called
- Verify `LoanSubmitOut.borrower_name` and `LoanSubmitOut.loan_amount` are populated (not None) if borrower and financials exist

**`src/frontend/src/services/submissionService.ts` — `saveDraft` function**
- Verify it calls `PUT /loans/{id}/financials` with financial data
- Verify it calls `PUT /loans/{id}/terms` with terms data
- Verify `createBorrowerForLoan` is called and `borrowerDbIds` prevents duplicate inserts
- Verify `createPropertyForLoan` is called for the subject property

If all of the above are true, the submission flow is already wired. The only remaining work is writing the test.

### Backend fix (if needed): ensure `create_loan` does not require 3 separate calls

The current flow is:
1. `POST /loans/` → creates `loans` row only (no financials/terms)
2. `PUT /loans/{id}/financials` → creates/updates `loan_financials`
3. `PUT /loans/{id}/terms` → creates/updates `loan_terms`
4. `POST /loans/{id}/submit` → transitions status to `submitted`

This is intentional — steps 2 and 3 are called by `saveDraft` during the wizard. The submit endpoint does not need to create satellite rows. **Do not change this pattern.**

What to fix only if broken:
- If `saveDraft` is NOT calling `PUT /financials` and `PUT /terms`, fix `submissionService.ts`
- If `submit_loan` returns `loan_amount: null` even when financials exist, the JOIN is broken — check the query

### Write `tests/backend/test_loan_submission_e2e.py`

This is the critical test for this phase. Write it even if no code changes are needed.

```python
# tests/backend/test_loan_submission_e2e.py
"""Loan submission end-to-end tests. See ROADMAP.md §B."""
import pytest
from uuid import uuid4
from sqlalchemy import text


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_submit_creates_all_three_rows(client, db, seed_minimum):
    """
    Full happy path:
    1. Create a loan draft (POST /loans/)
    2. PUT financials
    3. PUT terms
    4. POST submit
    5. Verify loans + loan_financials + loan_terms all exist in DB
    """
    token = seed_minimum["token"]  # admin token from seed_minimum fixture

    # Step 1: create loan
    create_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth_headers(token),
    )
    assert create_resp.status_code == 201
    loan_id = create_resp.json()["id"]

    # Step 2: put financials
    fin_resp = await client.put(
        f"/api/v1/loans/{loan_id}/financials",
        json={"loan_amount": 450000, "fico_score": 720, "ltv": 0.75, "dscr": 1.35},
        headers=_auth_headers(token),
    )
    assert fin_resp.status_code == 200

    # Step 3: put terms
    terms_resp = await client.put(
        f"/api/v1/loans/{loan_id}/terms",
        json={"interest_rate": 7.5, "term_months": 360, "rate_type": "fixed"},
        headers=_auth_headers(token),
    )
    assert terms_resp.status_code == 200

    # Step 4: submit
    submit_resp = await client.post(
        f"/api/v1/loans/{loan_id}/submit",
        headers=_auth_headers(token),
    )
    assert submit_resp.status_code == 200
    body = submit_resp.json()
    assert body["status"] == "submitted"
    assert body["loan_amount"] == 450000

    # Step 5: verify DB rows exist
    fin_row = db.execute(
        text("SELECT loan_amount FROM loan_financials WHERE loan_id = :id"),
        {"id": loan_id},
    ).fetchone()
    assert fin_row is not None
    assert float(fin_row.loan_amount) == 450000.0

    terms_row = db.execute(
        text("SELECT term_months FROM loan_terms WHERE loan_id = :id"),
        {"id": loan_id},
    ).fetchone()
    assert terms_row is not None
    assert terms_row.term_months == 360


@pytest.mark.integration
async def test_submit_rejects_non_draft_status(client, db, seed_minimum):
    """A loan that is already submitted cannot be submitted again — returns 422."""
    token = seed_minimum["token"]

    create_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "refinance", "loan_program": "bank_statement"},
        headers=_auth_headers(token),
    )
    loan_id = create_resp.json()["id"]

    # Submit once — should succeed
    r1 = await client.post(f"/api/v1/loans/{loan_id}/submit", headers=_auth_headers(token))
    assert r1.status_code == 200

    # Submit again — should fail
    r2 = await client.post(f"/api/v1/loans/{loan_id}/submit", headers=_auth_headers(token))
    assert r2.status_code == 422


@pytest.mark.integration
async def test_tenant_isolation_on_loan(client, db, seed_minimum):
    """A loan created by tenant A is not visible in tenant B's pipeline."""
    # This test requires the seed_minimum fixture to provide a second tenant token.
    # If seed_minimum only provides one tenant, mark this as skip with a TODO note.
    pytest.skip("Requires multi-tenant seed — implement when seed_minimum supports two tenants")
```

**Note on `seed_minimum`:** The `seed_minimum` fixture in `conftest.py` is currently a stub that returns `{}`. Before this test can run, it needs to create a tenant, a user, and return a valid JWT token. Update `conftest.py` to fill in `seed_minimum`:

```python
# In tests/backend/conftest.py — update the seed_minimum fixture
@pytest.fixture
async def seed_minimum(client, db):
    """Seeds the minimum data needed for integration tests: one tenant, one admin user."""
    from uuid import uuid4
    import bcrypt

    tenant_id = uuid4()
    user_id = uuid4()
    pw_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode()

    db.execute(text(
        "INSERT INTO tenants (id, name, slug, is_active) VALUES (:id, :name, :slug, true)"
    ), {"id": tenant_id, "name": "Test Lender", "slug": "test-lender"})

    db.execute(text(
        "INSERT INTO users (id, tenant_id, email, hashed_password, full_name, is_active) "
        "VALUES (:id, :tid, :email, :pw, :name, true)"
    ), {"id": user_id, "tid": tenant_id, "email": "test@origina.dev", "pw": pw_hash, "name": "Test Admin"})

    # Assign it_admin role
    db.execute(text(
        "INSERT INTO user_roles (user_id, role_id) "
        "SELECT :uid, id FROM roles WHERE name = 'it_admin'"
    ), {"uid": user_id})

    db.commit()

    # Get a JWT token via the login endpoint
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "test@origina.dev", "password": "TestPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_resp.status_code == 200, f"seed_minimum login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]

    return {"tenant_id": str(tenant_id), "user_id": str(user_id), "token": token}
```

**Phase 1.3 done when:**
- `test_submit_creates_all_three_rows` passes
- `test_submit_rejects_non_draft_status` passes
- Manual end-to-end: submit a loan through the wizard → borrower name and amount appear in pipeline
- `./scripts/run_tests.sh` passes

---

## Phase 1.4 — WorkspaceHome Real Data + All Tests Green

**Goal:** The loan workspace home section displays real interest rate, term, loan amount, LTV, FICO, and DSCR from the database. All B-gate tests pass.

### Frontend audit

**Read `src/frontend/src/hooks/useLoanDetail.ts` before coding.**

The hook currently uses `useEffect + Promise.all` to fetch loan, borrowers, financials, terms, and property. This works but is not React Query. **Do not rewrite it to React Query in this phase** — that's a Sprint 3 task. Focus only on making the data display correctly.

**Read `src/frontend/src/components/loans/workspace/WorkspaceHome.tsx`.**

The component already destructures `financials` and `terms` from `useLoanDetail`. Check whether they are displayed:
- Look for `financials?.loan_amount`, `financials?.fico_score`, `financials?.ltv`, `financials?.dscr`
- Look for `terms?.interest_rate`, `terms?.term_months`, `terms?.rate_type`

**If these fields are already rendered** (even as `-` fallbacks when null), no frontend change is needed. The fix is upstream: ensure financials and terms are created when a loan is submitted (Phase 1.3).

**If these fields are missing from the UI**, add a "Loan Details" panel to `WorkspaceHome` that shows:

```
Interest Rate    7.500%       Loan Amount   $450,000
Term             30 yr fixed  LTV           75.0%
Rate Type        Fixed        FICO Score    720
Lock Days        30           DSCR          1.35
```

Use the existing `fmtMoney`, `fmtPct`, `fmtRatio` helper functions already defined in the file.

### Write `tests/backend/test_loan_financials_endpoint.py`

```python
# tests/backend/test_loan_financials_endpoint.py
"""Loan financials and terms endpoint tests. See ROADMAP.md §B."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_get_financials_returns_correct_shape(client, db, seed_minimum):
    token = seed_minimum["token"]

    # Create loan + financials
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    await client.put(
        f"/api/v1/loans/{loan_id}/financials",
        json={"loan_amount": 600000, "fico_score": 740, "ltv": 0.70, "dscr": 1.45},
        headers=_auth(token),
    )

    # Fetch financials
    resp = await client.get(f"/api/v1/loans/{loan_id}/financials", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["loan_amount"]) == 600000.0
    assert body["fico_score"] == 740
    assert "loan_id" in body
    assert "updated_at" in body


@pytest.mark.integration
async def test_get_financials_404_when_none_created(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    resp = await client.get(f"/api/v1/loans/{loan_id}/financials", headers=_auth(token))
    assert resp.status_code == 404


@pytest.mark.integration
async def test_get_terms_returns_correct_shape(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "bank_statement"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    await client.put(
        f"/api/v1/loans/{loan_id}/terms",
        json={"interest_rate": 7.25, "term_months": 360, "rate_type": "fixed"},
        headers=_auth(token),
    )
    resp = await client.get(f"/api/v1/loans/{loan_id}/terms", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["interest_rate"]) == 7.25
    assert body["term_months"] == 360
    assert body["rate_type"] == "fixed"


@pytest.mark.integration
async def test_financials_scoped_to_tenant(client, db, seed_minimum):
    """A loan from tenant A cannot have its financials read by a different user
    in a different tenant. 404 is returned, not 403, to avoid leaking existence."""
    # This requires a second-tenant token. Skip until multi-tenant seed is available.
    pytest.skip("Requires multi-tenant seed fixture")
```

### Write `tests/frontend/WorkspaceHome.test.tsx`

```tsx
// tests/frontend/WorkspaceHome.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceHome } from "@/components/loans/workspace/WorkspaceHome";
import type { LoanSummary } from "@/types/loan";

// Mock the hooks that WorkspaceHome depends on
vi.mock("@/hooks/useLoanDetail", () => ({
  useLoanDetail: () => ({
    detail: {
      loan: { id: "loan-1", purpose: "purchase", loan_program: "dscr" },
      borrowers: [{ id: "b1", first_name: "Jane", last_name: "Smith", type: "primary_borrower" }],
      financials: {
        loan_id: "loan-1",
        loan_amount: 450000,
        fico_score: 720,
        ltv: 0.75,
        dscr: 1.35,
        updated_at: "2026-07-01T00:00:00Z",
      },
      terms: {
        loan_id: "loan-1",
        interest_rate: 7.5,
        term_months: 360,
        rate_type: "fixed",
        updated_at: "2026-07-01T00:00:00Z",
      },
      property: { address1: "123 Main St", city: "Miami", state: "FL", postal_code: "33101" },
    },
    loading: false,
  }),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn(), query: { loanId: "loan-1" } }),
}));

vi.mock("@/state/recentLoansStore", () => ({
  useRecentLoansStore: () => vi.fn(),
}));

const mockLoan: LoanSummary = {
  id: "loan-1",
  borrowerName: "Jane Smith",
  loanNumber: "OR-1001",
  channel: "Broker",
  status: "submitted",
  loanAmount: 450000,
  loanProgram: "dscr",
  propertyState: "FL",
  submittedAt: "2026-07-01",
  updatedAt: "2026-07-01",
  owner: "—",
  conditionsOpen: 2,
  conditionsSubmitted: 0,
  actionsNeeded: 2,
};

describe("WorkspaceHome", () => {
  it("renders without crashing", () => {
    render(<WorkspaceHome loan={mockLoan} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("displays the loan number", () => {
    render(<WorkspaceHome loan={mockLoan} />);
    expect(screen.getByText(/OR-1001/)).toBeInTheDocument();
  });
});
```

### Final B-gate checklist

Before closing Sprint 1, run:
```bash
./scripts/run_tests.sh
```

All of the following must be green:
- [ ] `tests/backend/test_health.py` (5 existing smoke tests)
- [ ] `tests/frontend/LoanPipelineTable.test.tsx` (2 existing smoke tests)
- [ ] `tests/backend/test_cors.py` (3 new tests from Phase 1.1)
- [ ] `tests/backend/test_pagination_envelope.py` (3 new tests from Phase 1.2)
- [ ] `tests/backend/test_loan_submission_e2e.py` (2 new tests from Phase 1.3)
- [ ] `tests/backend/test_loan_financials_endpoint.py` (3 new tests from Phase 1.4)
- [ ] `tests/frontend/WorkspaceHome.test.tsx` (2 new tests from Phase 1.4)

**Phase 1.4 done when:** All 20 tests pass. WorkspaceHome shows rate, term, amount, LTV, FICO, and DSCR for any seeded loan that has financials and terms.

---

## What NOT to change

- Do not modify `tests/backend/conftest.py` except for the `seed_minimum` fixture update described in Phase 1.3
- Do not change the `loans.py` `submit_loan` endpoint to create satellite rows atomically — the current 3-call pattern is correct
- Do not migrate `useLoanDetail` from `useEffect` to `useQuery` — that is Sprint 3
- Do not add S3 upload — that is Sprint 3
- Do not create new user accounts or build user management — that is Sprint 2
- Do not add the condition management UI — that is Sprint 2

---

## Validation handoff

After completing all four phases, the Claude Code validator will:
1. Run `./scripts/run_tests.sh` and verify all 20 tests pass
2. Start the dev server and manually test the demo path
3. Check that `GET /api/v1/loans/pipeline?skip=0&limit=50` returns the envelope shape
4. Verify CORS blocks unknown origins
5. Verify the default JWT secret causes a startup error in non-local mode
6. Open a loan workspace and verify financials and terms display real data
