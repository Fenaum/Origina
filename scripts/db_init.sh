#!/usr/bin/env bash
# Runs all SQL migration files in db/migrations/ in order.
# Safe to re-run — already-applied migrations are skipped (tracked in the
# schema_migrations table). See scripts/init_db.py for full documentation.
#
# Usage: ./scripts/db_init.sh
# (make executable first: chmod +x scripts/db_init.sh)
set -euo pipefail

# Change to repo root so relative paths (db/migrations/) resolve correctly
# regardless of where the script is called from.
cd "$(dirname "$0")/.."

# Prefer the repo virtualenv when present so migrations use the same dependency
# set as the application. Fall back to system python3 for containers/CI.
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x "./venv/bin/python3" ]]; then
  PYTHON_BIN="./venv/bin/python3"
fi

"$PYTHON_BIN" scripts/init_db.py
