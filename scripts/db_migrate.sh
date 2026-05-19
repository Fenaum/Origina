#!/usr/bin/env bash
# Apply pending database migrations.
#
# This project intentionally uses the raw SQL files in db/migrations/ as the
# schema-change source of truth. Alembic is present as a scaffold only; running
# both Alembic and raw SQL would create two independent migration histories and
# make it unclear which one owns production schema changes.
set -euo pipefail

cd "$(dirname "$0")/.."

# Prefer the repo virtualenv when present so migrations use the same dependency
# set as the application. Fall back to system python3 for containers/CI.
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x "./venv/bin/python3" ]]; then
  PYTHON_BIN="./venv/bin/python3"
fi

"$PYTHON_BIN" scripts/init_db.py
