#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Origina test runner — see ROADMAP.md "Testing Checkpoints" §A.3.
#
# Runs the full test suite:
#   1. Backend pytest  (tests/backend/) — needs Postgres + DATABASE_URL
#   2. Frontend vitest (tests/frontend/) — needs npm install
#
# Usage:
#   ./scripts/run_tests.sh           # run everything
#   ./scripts/run_tests.sh backend   # backend only
#   ./scripts/run_tests.sh frontend  # frontend only
#
# Exit code is non-zero if any suite fails.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Prefer repo virtualenv when present.
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x "$REPO_ROOT/.venv/bin/python3" ]]; then
  PYTHON_BIN="$REPO_ROOT/.venv/bin/python3"
fi

TARGET="${1:-all}"
BACKEND_RC=0
FRONTEND_RC=0
BACKEND_RAN=0
FRONTEND_RAN=0

# ── Backend ───────────────────────────────────────────────────────────────────

run_backend() {
  echo ""
  echo "╭─────────────────────────────────────────────────────────────╮"
  echo "│  Backend tests  (pytest tests/backend/)                     │"
  echo "╰─────────────────────────────────────────────────────────────╯"

  if [[ ! -d "tests/backend" ]]; then
    echo "✗ tests/backend/ not found — aborting."
    return 1
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    # Fall back to the dev .env so tests can run in the standard workflow.
    if [[ -f ".env" ]]; then
      echo "ℹ  DATABASE_URL not exported; sourcing .env"
      # shellcheck disable=SC1091
      set -a; source .env; set +a
    else
      echo "⚠  DATABASE_URL not set and .env missing — integration tests will be skipped."
    fi
  fi

  "$PYTHON_BIN" -m pytest tests/backend/ -v --tb=short
  return $?
}

# ── Frontend ──────────────────────────────────────────────────────────────────

run_frontend() {
  echo ""
  echo "╭─────────────────────────────────────────────────────────────╮"
  echo "│  Frontend tests  (vitest tests/frontend/)                   │"
  echo "╰─────────────────────────────────────────────────────────────╯"

  if [[ ! -d "tests/frontend" ]]; then
    echo "✗ tests/frontend/ not found — aborting."
    return 1
  fi

  if [[ ! -d "src/frontend/node_modules" ]]; then
    echo "ℹ  node_modules missing — running npm install first."
    (cd src/frontend && npm install) || return 1
  fi

  (cd src/frontend && npm run test)
  return $?
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$TARGET" in
  backend)
    run_backend; BACKEND_RC=$?; BACKEND_RAN=1
    ;;
  frontend)
    run_frontend; FRONTEND_RC=$?; FRONTEND_RAN=1
    ;;
  all|*)
    run_backend; BACKEND_RC=$?; BACKEND_RAN=1
    run_frontend; FRONTEND_RC=$?; FRONTEND_RAN=1
    ;;
esac

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "╭─────────────────────────────────────────────────────────────╮"
echo "│  Test Summary                                               │"
echo "╰─────────────────────────────────────────────────────────────╯"

if [[ $BACKEND_RAN -eq 1 ]]; then
  if [[ $BACKEND_RC -eq 0 ]]; then
    echo "  ✓ Backend:  PASS"
  else
    echo "  ✗ Backend:  FAIL ($BACKEND_RC)"
  fi
fi

if [[ $FRONTEND_RAN -eq 1 ]]; then
  if [[ $FRONTEND_RC -eq 0 ]]; then
    echo "  ✓ Frontend: PASS"
  else
    echo "  ✗ Frontend: FAIL ($FRONTEND_RC)"
  fi
fi

echo ""

# Exit non-zero if any suite failed.
if [[ $BACKEND_RC -ne 0 || $FRONTEND_RC -ne 0 ]]; then
  exit 1
fi

exit 0