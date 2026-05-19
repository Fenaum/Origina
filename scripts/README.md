# Database Scripts

## Source Of Truth

`db/migrations/*.sql` is the database schema-change source of truth.

The SQLAlchemy models in `src/backend/app/models/` are the application mapping
for reading and writing tables after they exist. They should mirror the schema,
but they should not create or migrate it.

Why keep both?

- SQL migrations preserve history: each file says exactly how an existing
  database moves from one version to the next.
- SQL can define PostgreSQL features the ORM does not fully own: extensions,
  enum types, triggers, trigger functions, partial indexes, and check
  constraints.
- Models keep application code typed and ergonomic, but they are not an audit
  trail and cannot safely tell production which historical changes already ran.

## Commands

`./scripts/db_init.sh`

Initializes a database by applying pending numbered SQL migrations. Safe to
re-run because applied files are tracked in `schema_migrations`.

`./scripts/db_migrate.sh`

Alias for the same migration runner. Use this after adding a new numbered SQL
migration.

Both wrappers prefer `./venv/bin/python3` when present, then fall back to
`python3`. That avoids relying on the ambiguous `python` command, which is not
available in every Linux environment.

## Important

Only files named like `001_extensions.sql` are applied automatically. Scratch
or demo SQL such as `query.sql` is intentionally ignored by the runner.

Seed files are handled specially: they run after all schema migrations and only
when `APP_ENV` is `local` or `development`.
