# Origina test suite

> See [ROADMAP.md — Testing Checkpoints](../docs/ROADMAP.md#testing-checkpoints) for the master plan and Definition of Done.

This directory was previously home to a few JS concept demos. As of June 2026 it hosts the **two test suites** that gate every roadmap milestone:

```
tests/
├── README.md                  ← you are here
├── backend/                   ← pytest suite (Python / FastAPI / SQLAlchemy)
│   ├── __init__.py
│   ├── conftest.py            ← fixtures: schema isolation, ASGI client, rate-limiter reset
│   ├── pytest.ini             ← asyncio_mode=auto, testpaths, markers
│   └── test_*.py              ← one file per feature area (19 files, 134+ tests)
└── frontend/                  ← vitest suite (React / RTL / jsdom)
    ├── setup.ts               ← @testing-library/jest-dom matchers
    └── *.test.tsx             ← one file per component (7 files, 13+ tests)
```

The vitest config lives at `src/frontend/vitest.config.ts` (not in this
directory) so `vitest/config` resolves from npm's working directory — it
points back here for the test files. See
[docs/TESTING.md §3](../docs/TESTING.md) for the reasoning.

## Running

From the repo root:

```bash
# Full suite
./scripts/run_tests.sh

# Backend only
./scripts/run_tests.sh backend

# Frontend only
./scripts/run_tests.sh frontend
```

Or directly:

```bash
# Backend
cd src/backend
python3 -m pytest ../../tests/backend/ -v

# Frontend
cd src/frontend
npm run test          # single pass
npm run test:watch    # interactive
```

## Conventions

- **Backend** uses `pytest` with `asyncio_mode=auto`. Test isolation is
  schema-per-run inside the existing dev Postgres — no testcontainers, no
  separate DB. See `tests/backend/conftest.py` for details.
- **Frontend** uses `vitest` with `jsdom` and `@testing-library/react`. Path
  alias `@/*` mirrors the production `tsconfig.json`.
- Tests are **co-located by domain** (`test_<feature>.py` /
  `<Component>.test.tsx`), not by type. New tests go next to the feature
  they cover.

## Adding a new test

1. Pick the right suite (backend or frontend).
2. Match the naming convention: `test_<feature>.py` (backend) or
   `<Component>.test.tsx` (frontend).
3. Use the existing fixtures from `conftest.py` / `setup.ts`. Don't
   re-import `app.models` or recreate path aliases — they're already wired.
4. Mark the test:
   - `@pytest.mark.smoke` — fast, no DB
   - `@pytest.mark.integration` — touches the DB
   - `@pytest.mark.slow` — >2s (seed-heavy, full pipeline)
5. Link the test file path in the matching `ROADMAP.md` checklist entry
   before moving the item to "What We Did Well". This is enforced by the
   new Definition of Done rule.

## Coverage gates (enforced by `run_tests.sh` and CI since Sprint 5)

See ROADMAP §D and [docs/TESTING.md §9–10](../docs/TESTING.md):

- `pytest --cov=app.api --cov=app.services --cov-fail-under=70`
- `pytest --cov=app.services.condition_lifecycle --cov-fail-under=90`
- Every workspace section has at least one frontend smoke test
- Every bug in `BUILD_HISTORY.md` has a named regression test