# Schema initialization is handled by SQL migrations, not SQLAlchemy's create_all().
#
# WHY: create_all() builds tables from Python models but cannot install the
# PostgreSQL ENUM types, PL/pgSQL trigger functions, or triggers that enforce
# updated_at auto-updates and data integrity. Running create_all() produces
# a schema that looks correct in Python but is missing DB-level enforcement.
#
# HOW to initialize or migrate the database:
#   python scripts/init_db.py
#
# That script runs every file in db/migrations/ in order, tracks which files
# have been applied in a schema_migrations table, and is safe to re-run.

