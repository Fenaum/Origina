# Bug Log

A running log of production-blocking bugs discovered during development, with
reproduction steps, root cause, fix, and prevention guidance. Bugs here should
be either resolved (with the fix noted) or have an owner / sprint assignment
when carried forward.

Conventions:
- **ID**: `BUG-NNN` (assigned in chronological order)
- **Status**: `open` | `in-progress` | `resolved` | `wont-fix`
- **Severity**: `blocker` (cannot run) | `major` (feature unusable) | `minor` (workaround exists) | `chore` (housekeeping)

---

## BUG-001 — `slowapi` not installed in venv causes backend startup to fail

- **Status:** resolved
- **Severity:** blocker
- **Discovered:** 2026-07-10
- **Sprint:** 5 (Production Hardening)
- **Owner:** platform

### Symptom
`uvicorn app.core.main:app --reload` crashes on startup with:

```
File ".../src/backend/app/core/main.py", line 4, in <module>
    from slowapi import _rate_limit_exceeded_handler
ModuleNotFoundError: No module named 'slowapi'
```

Even after a successful `pip install`, the server can keep failing with
`[Errno 48] Address already in use` because a previously-running
`uvicorn --reload` parent process is still bound to port 8000; its reload
child subprocess re-runs the old import path and re-hits the same error.

### Reproduction
1. Clone the repo and create a fresh venv (`python3 -m venv venv`).
2. **Do NOT** run `pip install -r requirements.txt`.
3. `cd src/backend && uvicorn app.core.main:app --reload`
4. Observe the `ModuleNotFoundError` on `main.py:4`.

Variant (the one that masked the fix during this incident):
1. Install deps, start uvicorn — server runs fine.
2. While uvicorn is running, run `pip uninstall slowapi -y` (simulates a
   fresh clone that never installed it).
3. Trigger a reload (touch any file under `src/backend/`).
4. The reload subprocess re-imports `main.py` and crashes with
   `ModuleNotFoundError`. The parent process is still bound to port 8000,
   so a fresh `uvicorn` launch fails with `[Errno 48]`.

### Root cause
- `requirements.txt` lists `slowapi==0.1.9` (line 48) for Sprint 5 §5.1
  (rate limiting on `/auth/login`), but `pip install -r requirements.txt`
  had not been run against this venv.
- A stale `uvicorn --reload` process (started 10:27 PM, before the install
  at 11:09 AM) was still bound to port 8000. Its WatchFiles-driven reload
  child re-imported `main.py` and hit the same `ModuleNotFoundError`,
  making it look like the install had failed.
- No `pre-flight` check exists in the repo to assert that all
  `requirements.txt` packages are actually importable before `uvicorn`
  tries to load the app.

### Fix applied
1. `pip install -r requirements.txt` (installed `slowapi==0.1.9` +
   transitive deps `limits`, `deprecated`, `wrapt`).
2. `kill <stale_uvicorn_PID>` to free port 8000.
3. Fresh `uvicorn app.core.main:app --host 127.0.0.1 --port 8000` →
   `Application startup complete`, `GET /` → 200, `GET /docs` → 200.

### Prevention / follow-ups
- **Add a `make doctor` or `scripts/check_deps.sh`** that runs
  `python -c "import slowapi, fastapi, sqlalchemy, ..."` and exits non-zero
  with a clear message if any package is missing. Wire it into the GitHub
  Actions CI workflow (Sprint 5 §5.3) so a missing-dep PR can't merge.
- **Document `pip install -r requirements.txt` as a required step** in
  `README.md` and `docs/CURRENT_SPRINT.md` Sprint 5 onboarding checklist
  — currently `.clinerules` mentions it but the README quickstart does
  not.
- **Consider pinning `slowapi` in `requirements.txt` to a `>=` floor**
  (e.g. `slowapi>=0.1.9,<0.2`) once Sprint 5 ships to avoid surprise
  breaking upgrades, matching the convention used for `pydantic`,
  `httpx`, and the test stack.
- **`uvicorn --reload` + missing-dep footgun**: a stale `--reload` parent
  will silently keep crashing on reload after a dep is uninstalled. The
  reload child logs the traceback but the parent stays bound to the port,
  blocking subsequent launches. Document this in `docs/TESTING.md` so
  engineers know to `kill` the parent rather than chasing the child
  traceback.

---

## BUG-002 — `domain_events` table missing on dev DB; outbox dispatcher errors on startup

- **Status:** open
- **Severity:** minor (server still starts; dispatcher is silently skipped)
- **Discovered:** 2026-07-10
- **Sprint:** 5 (Production Hardening)
- **Owner:** platform / data

### Symptom
On backend startup, the Sprint 4 outbox dispatcher logs:

```
psycopg2.errors.UndefinedTable: relation "domain_events" does not exist
```

The error is caught by the `try/except` in `app.core.main:on_startup`, so
the server still starts and serves traffic — but the dispatcher (which
sends email notifications on loan events) is silently disabled.

### Reproduction
1. Apply migrations through `130_analytics_saved_views.sql` only (skip
   `131_domain_events.sql`).
2. `uvicorn app.core.main:app --reload`
3. Observe the `UndefinedTable` traceback in the startup log.

### Root cause
Migration `db/migrations/131_domain_events.sql` (Sprint 4 §4.4 — outbox +
dispatcher) has not been applied to the dev DB. The startup hook wraps
`run_dispatch_in_background()` in `try/except`, so a missing table logs
as a warning rather than failing startup — by design, but it masks the
underlying migration drift.

### Fix
Run `scripts/db_migrate.sh` to apply pending migrations, or
`scripts/db_init.sh` for a clean reset.

### Prevention / follow-ups
- The migration runner already tracks applied files in `schema_migrations`,
  so this is purely an operator action — but consider adding a
  `make migrate` target and documenting it in `README.md` next to the
  existing `docker-compose up -d` quickstart.
- Long-term: a `db drift` check in CI (compare expected vs. applied
  migrations against the dev/QA DB) would catch this earlier. Tracked
  for a future hardening sprint.

---

## Adding a new entry

1. Copy the template below and append to this file.
2. Assign the next sequential `BUG-NNN` ID.
3. Link from `docs/CURRENT_SPRINT.md` if the bug is active in the
   current sprint.
4. Move to `resolved` (with fix notes) or `wont-fix` (with rationale)
   when closed.

```markdown
## BUG-NNN — <one-line summary>

- **Status:** open
- **Severity:** blocker | major | minor | chore
- **Discovered:** YYYY-MM-DD
- **Sprint:** <sprint name>
- **Owner:** <team / person>

### Symptom
<what the user sees>

### Reproduction
1. <step>
2. <step>

### Root cause
<why it happens>

### Fix
<what was done / what to do>

### Prevention / follow-ups
- <future work>