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
- Models define structure only (columns, relationships)
- Do NOT put business logic in models
- Ensure field naming aligns with Pydantic schemas
