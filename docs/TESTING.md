# Origina — Testing Guide

> **Cross-links:** [ROADMAP.md - Testing Checkpoints](ROADMAP.md#testing-checkpoints) | [END_USER_TEST_SCRIPTS.md](END_USER_TEST_SCRIPTS.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md) | [tests/README.md](../tests/README.md)

This document is the **how-to** companion to the [Testing Checkpoints section of ROADMAP.md](ROADMAP.md#testing-checkpoints). It covers setup, running, writing, and debugging tests for both the FastAPI backend and the Next.js frontend.

For the **what** (which automated tests must pass to clear each milestone) and the **why** (Definition of Done, coverage gates), see ROADMAP. For manual business validation by end users, see [END_USER_TEST_SCRIPTS.md](END_USER_TEST_SCRIPTS.md).

---

## Table of Contents

1. [Quick start](#1-quick-start)
2. [Backend test suite (pytest)](#2-backend-test-suite-pytest)
3. [Frontend test suite (vitest)](#3-frontend-test-suite-vitest)
4. [Unified runner script](#4-unified-runner-script)
5. [Test isolation strategy](#5-test-isolation-strategy)
6. [Writing a new backend test](#6-writing-a-new-backend-test)
7. [Writing a new frontend test](#7-writing-a-new-frontend-test)
8. [Markers and conventions](#8-markers-and-conventions)
9. [Coverage gates](#9-coverage-gates)
10. [CI integration](#10-ci-integration)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Quick start

Prerequisites:
- **Python 3.11+** with the packages from `requirements.txt` installed
- **Node.js 20+** with `npm`
- **PostgreSQL 16** running locally (the existing `docker-compose.yml` is enough)
- `DATABASE_URL` exported in your shell **or** a `.env` file at the repo root

From the repo root:

```bash
# 1. Install backend deps (includes pytest, pytest-asyncio, pytest-cov, httpx)
pip install -r requirements.txt

# 2. Install frontend deps (includes vitest, @testing-library/*, jsdom)
cd src/frontend && npm install && cd ../..

# 3. Make sure Postgres is up
docker-compose up -d

# 4. Run everything
./scripts/run_tests.sh
```

Expected output (truncated):

```
╭─────────────────────────────────────────────────────────────╮
│  Backend tests  (pytest tests/backend/)                     │
╰─────────────────────────────────────────────────────────────╯
tests/backend/test_health.py::test_health_endpoint_returns_ok PASSED
tests/backend/test_health.py::test_root_serves_metadata PASSED
tests/backend/test_health.py::test_docs_endpoint_is_served PASSED
tests/backend/test_health.py::test_quote_ident_escapes_double_quote PASSED
tests/backend/test_health.py::test_schema_name_is_unique_per_session PASSED
═════════════════════════════════════════════════════════════════
╭─────────────────────────────────────────────────────────────╮
│  Frontend tests  (vitest tests/frontend/)                   │
╰─────────────────────────────────────────────────────────────╯
 ✓ tests/frontend/LoanPipelineTable.test.tsx (2)
   ✓ renders_empty_state_when_no_loans
   ✓ renders_table_rows_for_loans
═════════════════════════════════════════════════════════════════
╭─────────────────────────────────────────────────────────────╮
│  Test Summary                                               │
╰─────────────────────────────────────────────────────────────╯
  ✓ Backend:  PASS
  ✓ Frontend: PASS
```

---

## 2. Backend test suite (pytest)

### Layout

```
tests/backend/
├── __init__.py        # marks the dir as a package
├── conftest.py        # fixtures: schema isolation, ASGI client, rate-limiter reset
├── pytest.ini         # asyncio_mode=auto, testpaths, markers, addopts
└── test_*.py          # one file per feature area (19 files, 134+ tests as of Sprint 5)
```

Each sprint's B-gate tests live in named files (`test_auth_cookie.py`, `test_condition_lifecycle.py`, `test_pagination_envelope.py`, …). The authoritative list of which file gates which sprint is the B-Gate Tests Checklist in [CURRENT_SPRINT.md](CURRENT_SPRINT.md) and the sprint archives in `docs/sprints/`.

### Configuration (`pytest.ini`)

| Setting | Value | Why |
|---|---|---|
| `testpaths` | `tests/backend` | Pytest discovers tests here, so `pytest` works from repo root. |
| `python_files` | `test_*.py` | Only files matching this glob are collected. |
| `asyncio_mode` | `auto` | Every async test runs under `pytest-asyncio` without needing `@pytest.mark.asyncio`. |
| `markers` | `smoke`, `integration`, `slow` | Registered custom markers. Use them to filter runs. |
| `addopts` | `-ra --strict-markers --tb=short` | Show summary of all reasons; error on unknown markers; concise tracebacks. |

### Running

```bash
# From repo root — recommended
./scripts/run_tests.sh backend

# Or directly with the repo venv
.venv/bin/python3 -m pytest tests/backend/ -v

# Filter by marker
.venv/bin/python3 -m pytest tests/backend/ -v -m smoke          # smoke only
.venv/bin/python3 -m pytest tests/backend/ -v -m "not slow"     # skip slow
.venv/bin/python3 -m pytest tests/backend/ -v -k "health"       # by test name
```

### Fixtures (from `conftest.py`)

| Fixture | Scope | Purpose |
|---|---|---|
| `test_schema_name` | session | Unique schema name like `test_origina_a3f9c1b8e4d2`. |
| `test_engine` | session | SQLAlchemy engine bound to the test schema. Tables are created at session start, schema dropped at session end. |
| `test_session_factory` | session | `sessionmaker` bound to the test engine. |
| `db` | function | Per-test DB session with `search_path` pinned to the test schema. |
| `client` | function | `httpx.Client` against the FastAPI app via `ASGITransport`. `get_db` is overridden to use the test schema. |
| `seed_minimum` | function | Stub — returns `{}`. Filled in alongside the first integration test. |

---

## 3. Frontend test suite (vitest)

### Layout

```
src/frontend/
└── vitest.config.ts                # jsdom env + aliases for React, RTL, jest-dom

tests/frontend/
├── setup.ts                        # @testing-library/jest-dom matchers
└── LoanPipelineTable.test.tsx      # foundation smoke tests (2 tests)
```

The **config lives in `src/frontend/`** (not `tests/frontend/`) so that `vitest/config` resolves from the working directory that `npm` uses when it runs scripts. The config then points at `tests/frontend/` for the actual test files and setup. See [Troubleshooting](#vitest-resolves-but-npm-run-test-says-no-tests-found) for the full reasoning.

### Configuration (`src/frontend/vitest.config.ts`)

| Setting | Value | Why |
|---|---|---|
| `environment` | `jsdom` | DOM globals (`window`, `document`) available without a real browser. |
| `globals` | `true` | `describe`, `it`, `expect` are available without imports. |
| `setupFiles` | `tests/frontend/setup.ts` | Registers `@testing-library/jest-dom` matchers. |
| `include` | `tests/frontend/**/*.test.{ts,tsx}` | Co-located tests under `tests/frontend/`. |
| `css` | `false` | Don't pull the design-system CSS into unit tests. |
| `esbuild.jsx` | `automatic` | JSX uses the automatic runtime so test files don't need `import React`. |
| `resolve.alias` | `@` → `src/frontend/src` | Mirrors `tsconfig.json` paths. |
| `resolve.alias` | `react`, `react-dom`, `@testing-library/*` → absolute paths in `node_modules` | Forces vite to resolve test-only deps against `src/frontend/node_modules` (it can't traverse there from `tests/frontend/` on its own). |

### Running

```bash
# From repo root
./scripts/run_tests.sh frontend

# Or directly
cd src/frontend
npm run test          # single pass
npm run test:watch    # interactive (re-runs on file save)
npm run test -- --ui  # open Vitest UI (if @vitest/ui is installed)
```

---

## 4. Unified runner script

`scripts/run_tests.sh` orchestrates both suites and prints a summary.

```bash
./scripts/run_tests.sh           # run backend + frontend
./scripts/run_tests.sh backend   # backend only
./scripts/run_tests.sh frontend  # frontend only
```

Behaviour:
- Detects `.venv/bin/python3` automatically; falls back to system `python3`.
- Sources `.env` if `DATABASE_URL` is not exported (so integration tests can run in the standard dev workflow).
- Runs `npm install` if `src/frontend/node_modules` is missing.
- Exits non-zero if any suite fails — safe to use in CI.

---

## 5. Test isolation strategy

**Backend** uses **schema-per-test-run** inside the existing dev Postgres:

1. Session start: `CREATE SCHEMA test_origina_<uuid>` in the existing `originadb` database.
2. Tables are created into the test schema via `Base.metadata.create_all` (good enough for smoke tests; will switch to running real `db/migrations/*.sql` files once we add a Python migration runner).
3. Every fixture that opens a DB session issues `SET search_path TO test_origina_<uuid>` so all reads/writes stay isolated.
4. Session end: `DROP SCHEMA … CASCADE`.

**Why not a separate DB?**
- Re-uses the dev Postgres from `docker-compose.yml` — no extra services.
- Migrations stay in sync (same Postgres version, same `pg_hba.conf`, same extensions).
- Test runs leave no orphaned databases.

**Why not testcontainers?**
- Adds ~10s of startup per run.
- Requires Docker socket access from inside pytest.
- The schema approach gives equivalent isolation for our current scale (single-digit test writers, sub-100-test suites).

**Frontend** uses **jsdom** — fully in-memory DOM, no browser, no network. Each test gets a fresh DOM because `@testing-library/react` calls `cleanup()` automatically via `vitest`'s globals.

---

## 6. Writing a new backend test

### Template

```python
# tests/backend/test_<feature>.py
"""Tests for <feature>. See ROADMAP.md §<X>."""
from __future__ import annotations

import pytest


@pytest.mark.integration
async def test_<scenario>(client, db):
    # Arrange — seed via `db` if needed
    ...

    # Act — call the API via `client` (note the `await`)
    response = await client.get("/api/v1/<endpoint>/")

    # Assert
    assert response.status_code == 200
    assert response.json()["..."] == "..."
```

### Rules

1. **Always use the `client` fixture** — never start a real uvicorn. The fixture uses `httpx.ASGITransport` against the in-process app.
2. **Mark with `@pytest.mark.integration`** if the test touches the DB. Smoke tests use `@pytest.mark.smoke`.
3. **Use the `db` fixture for setup, not raw SQL.** `db.execute(text("INSERT INTO ..."))` is fine, but prefer service-layer functions when they exist (`from app.services.loan_repo import create_loan`).
4. **Tenant scoping.** Every test that creates a loan must set `tenant_id` explicitly — there is no "current tenant" in tests.
5. **No network calls.** Mock `httpx.AsyncClient` outbound calls with `pytest-httpx` or `respx` if your test needs to fake an external API.

### Example: testing the pagination envelope (from ROADMAP §B)

```python
# tests/backend/test_pagination_envelope.py
import pytest
from uuid import uuid4

@pytest.mark.integration
async def test_loans_returns_envelope(client, db):
    # Seed 5 loans
    from app.models.loan import Loan
    for _ in range(5):
        db.add(Loan(id=uuid4(), loan_number="OQ-TEST", status="submitted", tenant_id=uuid4()))
    db.commit()

    response = await client.get("/api/v1/loans/?skip=0&limit=10")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["total"], int)
```

---

## 7. Writing a new frontend test

### Template

```tsx
// tests/frontend/<Component>.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyComponent } from "@/components/path/MyComponent";

describe("MyComponent", () => {
  it("renders without crashing", () => {
    render(<MyComponent prop="value" />);
    expect(screen.getByText("value")).toBeInTheDocument();
  });

  it("responds to click", async () => {
    const user = userEvent.setup();
    render(<MyComponent prop="value" />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(/* ... */).toBe(/* ... */);
  });
});
```

### Rules

1. **Co-locate tests next to the feature.** `tests/frontend/MyComponent.test.tsx`, not `tests/frontend/unit/MyComponent.test.tsx`.
2. **Use semantic queries first.** `getByRole("button", { name: /submit/i })` is preferred over `getByText("Submit")`. This catches a11y regressions for free.
3. **No network calls.** Wrap `fetch` / axios in `vi.mock(...)` at the top of the file, or use MSW (`msw` package) for realistic network mocking.
4. **No CSS assertions.** `css: false` in vitest config means styles are not loaded. Test behaviour, not pixels.
5. **Reset state between tests.** Zustand stores persist across tests by default. Use `vi.resetModules()` or reset stores in `beforeEach`.

---

## 8. Markers and conventions

| Marker | Suite | When to use |
|---|---|---|
| `@pytest.mark.smoke` | backend | Fast, no DB. Must pass in <1s. Examples: `/health`, `/`, `/docs`. |
| `@pytest.mark.integration` | backend | Touches the database via `db` or `client` fixture. Requires `DATABASE_URL`. Skipped automatically if env var missing. |
| `@pytest.mark.slow` | backend | >2s (e.g., full pipeline seed). Filter with `-m "not slow"` for fast iteration. |

Markers are registered in `tests/backend/pytest.ini`. Adding a new marker requires updating that file.

---

## 9. Coverage gates

See [ROADMAP §D](ROADMAP.md#d-coverage-gates-for-priority-3--priority-4).

### Local coverage run

The unified runner enforces both gates — this is the same command CI runs:

```bash
./scripts/run_tests.sh backend
```

Under the hood it runs two pytest passes:

```bash
# Gate 1 — overall API + services coverage ≥ 70%
.venv/bin/python3 -m pytest tests/backend/ \
  --cov=app.api \
  --cov=app.services \
  --cov-report=term-missing \
  --cov-fail-under=70

# Gate 2 — condition lifecycle state machine ≥ 90%
.venv/bin/python3 -m pytest tests/backend/test_condition_lifecycle.py \
  --cov=app.services.condition_lifecycle \
  --cov-report=term-missing \
  --cov-fail-under=90
```

### Gates

| Path | Threshold | Why |
|---|---|---|
| `app/api/` | ≥ 70% | All HTTP entry points — must be exercised. |
| `app/services/condition_lifecycle.py` | ≥ 90% | State machine for condition transitions; the highest-risk surface in the app. |
| Every workspace section (`Processing`, `Underwriting`, etc.) | ≥ 1 smoke test | The "Section renders without crashing" contract. |
| Every bug in `BUILD_HISTORY.md` | ≥ 1 named regression test | So bugs cannot silently return. |

---

## 10. CI integration

CI lives at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (added Sprint 5 §5.2). It runs on every push to `main` / `feature/**` / `sprint-**` and on every PR targeting `main`. Two parallel jobs:

| Job | Steps | Fails when |
|---|---|---|
| **backend** | Postgres 16 service → `pip install` → `scripts/db_init.sh` → `./scripts/run_tests.sh backend` | Any pytest failure, overall `app.api`+`app.services` coverage < 70%, or `condition_lifecycle` coverage < 90% |
| **frontend** | `npm ci` → `npm run lint` → `npx tsc --noEmit` → `./scripts/run_tests.sh frontend` → `npm run build` | Any lint error, type error, vitest failure, or build failure |

Both jobs call the **same `scripts/run_tests.sh` entry point used locally** — if CI is red, the identical command reproduces it on your machine.

### How to read a failing CI run

1. **Open the failing job** (Actions tab → the red run → `backend` or `frontend`). The failing step is expanded automatically.
2. **Identify which gate broke:**
   - `FAILED tests/backend/test_...` → a test regression. Reproduce with `./scripts/run_tests.sh backend`, or narrow to the file: `.venv/bin/python3 -m pytest tests/backend/test_<file>.py -v`.
   - `Required test coverage of 70% not reached` → new code in `app/api/` or `app/services/` without tests. The `term-missing` report above the failure lists uncovered line numbers per file.
   - `Required test coverage of 90% not reached` (second pytest pass) → `condition_lifecycle.py` changed without matching tests.
   - Frontend `✖ eslint` / `error TS` → run `npm run lint` / `npx tsc --noEmit` from `src/frontend/`.
   - Vitest `FAIL tests/frontend/...` → `./scripts/run_tests.sh frontend` reproduces it.
3. **Common environment-only failures:**
   - `db_init.sh` step fails → usually a new migration with a syntax error or an out-of-order dependency; run `scripts/db_reset.sh` locally to replay all migrations from scratch.
   - `npm ci` fails → `package-lock.json` out of sync with `package.json`; run `npm install` locally and commit the lockfile.
   - Passes locally, fails in CI → stale local state; CI uses `npm ci` and a fresh Postgres, so replay locally with `scripts/db_reset.sh` + `rm -rf src/frontend/node_modules && npm ci`.
4. **Red builds block merge** — fix forward on the branch; the `concurrency` group cancels superseded runs automatically.

---

## 11. Troubleshooting

### `ModuleNotFoundError: No module named 'app'`

The conftest prepends `src/backend` to `sys.path`. If you run pytest from a directory other than the repo root, this won't happen. **Fix:** always run from the repo root, or pass `pytest tests/backend/`.

### `DATABASE_URL not set` warning, all integration tests skipped

The conftest's `pytest_collection_modifyitems` hook automatically skips `@pytest.mark.integration` tests when `DATABASE_URL` is not in the environment. **Fix:** either export `DATABASE_URL` in your shell, or create a `.env` file at the repo root (the runner sources it automatically).

### `relation "loans" does not exist` mid-suite

The test session creates tables via `Base.metadata.create_all` at session start. If you see this mid-suite, the session fixture probably never ran (e.g., the previous test crashed during collection). **Fix:** re-run, or `pytest --setup-show` to see fixture setup order.

### `Error: Cannot find module '@/components/...'`

The Vitest config sets the `@` alias to `src/frontend/src`. If you run `npm run test` from the wrong directory, it can't resolve. **Fix:** `cd src/frontend && npm run test`.

### `vitest` resolves but `npm run test` says "no tests found"

The Vitest config was relocated to `src/frontend/vitest.config.ts` so that `vitest/config` can resolve from the working directory that npm uses (`src/frontend/`). It points back at `tests/frontend/` for the test files and setup. **Fix:** always run `npm run test` from inside `src/frontend/`.

### `'ASGITransport' object has no attribute 'handle_request'` / `__enter__`

This is the symptom of using sync `httpx.Client` with the async-only `ASGITransport` (httpx 0.28+). The old pattern `httpx.Client(app=app)` was removed in httpx 0.28 — the new pattern is `httpx.AsyncClient(transport=httpx.ASGITransport(app=app))` with **async** test functions. See `tests/backend/conftest.py::client` and the `async def` test signatures in `tests/backend/test_health.py` for the canonical example.

### `Failed to resolve import "@testing-library/jest-dom" from "tests/frontend/setup.ts"`

Vite's resolver won't traverse from `tests/frontend/` back to `src/frontend/node_modules` for bare imports. The `vitest.config.ts` has explicit aliases for `@testing-library/jest-dom`, `@testing-library/react`, `react`, `react/jsx-dev-runtime`, `react/jsx-runtime`, and `react-dom` that point at the resolved file paths inside `src/frontend/node_modules`. If you add a new test-only dep, add a corresponding alias.

### `ReferenceError: React is not defined` in a `.test.tsx`

Two things are required: `esbuild: { jsx: "automatic" }` in `vitest.config.ts` (so the JSX compiler inserts the right `react/jsx-dev-runtime` import automatically) and aliases for `react` and the JSX runtimes. Both are set in `src/frontend/vitest.config.ts` — see that file before changing the JSX setup.

### `Permission denied` running `./scripts/run_tests.sh`

The script needs to be executable. **Fix:** `chmod +x scripts/run_tests.sh`.

### Test passes locally but fails in CI

Most common cause: stale `node_modules` or `.venv`. **Fix:** ensure CI uses `npm ci` (not `npm install`) and `pip install --upgrade pip` before installing requirements.

---

## Document maintenance

- **Update when:** the test harness changes (new fixtures, new markers, new runner options), or when a new common test pattern emerges.
- **Cross-link to:** [ROADMAP.md — Testing Checkpoints](ROADMAP.md#testing-checkpoints) for the master plan; [tests/README.md](../tests/README.md) for the developer-facing cheat sheet.
