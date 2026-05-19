"""
scripts/init_db.py — SQL migration runner.

WHY this replaces Base.metadata.create_all():
  create_all() generates schema from Python ORM models only. It cannot:
    • create PostgreSQL ENUM types  (those live in 030_types.sql)
    • install PL/pgSQL trigger functions (001_extensions.sql)
    • attach triggers to tables
    • create partial or expression-based indexes

  Running create_all() produces an incomplete schema: updated_at columns
  exist but never auto-update (no trigger), ENUMs are undefined at the DB
  level, etc. The SQL files in db/migrations/ are the single authoritative
  schema definition. This script runs them in order.

HOW it works:
  • A schema_migrations table tracks which files have been applied.
  • Re-running the script is safe — already-applied files are skipped.
  • Each file runs in its own transaction; a failure rolls back that file
    without affecting previously applied migrations.
  • Seed files (name contains "seed") are skipped outside local/development
    environments to keep staging/production clean.

USAGE:
  python scripts/init_db.py
  (DATABASE_URL must be set in the environment or a .env file)
"""
import os
import re
import sys
from pathlib import Path

# Allow importing from src/backend (e.g. dotenv, app config)
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "backend"))

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit(
        "ERROR: DATABASE_URL is not set.\n"
        "Add it to your .env file:  DATABASE_URL=postgresql://origina:origina123@localhost/originadb"
    )

import psycopg2

REPO_ROOT = Path(__file__).parent.parent
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"
APP_ENV = os.getenv("APP_ENV", "local")
MIGRATION_FILENAME = re.compile(r"^\d{3}_.+\.sql$")


def _connect() -> "psycopg2.connection":
    # isolation_level defaults to READ COMMITTED with manual commit/rollback,
    # which gives us transaction-per-migration semantics below.
    return psycopg2.connect(DATABASE_URL)


def _ensure_tracking_table(conn) -> None:
    """
    schema_migrations records every .sql file that has been applied.
    Using a DB table (not a file) means the record is always co-located
    with the schema it describes — no external state to lose.
    """
    with conn.cursor() as cur:
        cur.execute("""
            create table if not exists schema_migrations (
                filename   text        primary key,
                applied_at timestamptz not null default now()
            )
        """)
    conn.commit()


def _is_applied(conn, filename: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "select 1 from schema_migrations where filename = %s",
            (filename,),
        )
        return cur.fetchone() is not None


def _apply(conn, sql_file: Path) -> None:
    """
    Execute the file and record it — both in one transaction.
    If any statement in the file fails the whole file is rolled back,
    which leaves the DB in a consistent state and schema_migrations
    without an entry for the failed file. Fix the SQL, re-run the script.
    """
    sql = sql_file.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "insert into schema_migrations (filename) values (%s)",
            (sql_file.name,),
        )
    conn.commit()


def run() -> None:
    # Sort by filename — the numeric prefix (001_, 010_, …) orders them correctly.
    #
    # Only numbered files are treated as migrations. This intentionally excludes
    # scratch/demo SQL such as query.sql so a helper file cannot accidentally
    # mutate real data during schema setup.
    numbered_files = sorted(
        path for path in MIGRATIONS_DIR.glob("*.sql")
        if MIGRATION_FILENAME.match(path.name)
    )

    # Seed files depend on the real schema existing first. Keep their numbered
    # prefix for historical compatibility, but always run them after schema
    # migrations so 003_seed.sql does not run before 010_tenants.sql.
    schema_files = [f for f in numbered_files if "seed" not in f.name.lower()]
    seed_files = [f for f in numbered_files if "seed" in f.name.lower()]
    migration_files = schema_files

    # Seed files create fake dev data (users, loans, etc.). Never run them
    # in environments that touch real data.
    if APP_ENV in ("local", "development"):
        migration_files = schema_files + seed_files
    else:
        print(f"[env={APP_ENV}] Seed files excluded.")

    conn = _connect()

    try:
        _ensure_tracking_table(conn)

        applied = 0
        skipped = 0

        for sql_file in migration_files:
            if _is_applied(conn, sql_file.name):
                print(f"  skip   {sql_file.name}")
                skipped += 1
                continue

            print(f"  apply  {sql_file.name} … ", end="", flush=True)
            try:
                _apply(conn, sql_file)
                print("done")
                applied += 1
            except Exception as exc:
                conn.rollback()
                print(f"FAILED\n\nError in {sql_file.name}:\n  {exc}")
                sys.exit(1)

    finally:
        conn.close()

    print(f"\n{applied} migration(s) applied, {skipped} already up to date.")


if __name__ == "__main__":
    run()
