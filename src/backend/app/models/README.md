# Models Layer (Database ORM)

Contains SQLAlchemy ORM models representing database tables:
- Loan
- Borrower
- Property
- User
- Document
- Condition
- StatusHistory

Rules:
- Models define the application mapping only (columns, relationships)
- Schema changes belong in `db/migrations/*.sql`, then models are updated to
  mirror the new schema
- Do NOT put business logic in models
- Ensure field naming aligns with Pydantic schemas

Why models do not initialize the DB:

`Base.metadata.create_all()` can create a rough table layout, but it is not a
safe migration system. It does not preserve change history, does not know which
production changes already ran, and does not fully own PostgreSQL-specific
objects used here such as enum types, triggers, trigger functions, partial
indexes, and check constraints.

The secure pattern for this project is:

1. Add a numbered SQL migration in `db/migrations/`.
2. Update the SQLAlchemy model so application code matches the schema.
3. Run `./scripts/db_migrate.sh`.
