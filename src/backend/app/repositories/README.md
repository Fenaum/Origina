# Repository Layer (Data Access)

Handles CRUD operations for models.

Responsibilities:
- Query the database
- Insert/update/delete records
- Return ORM objects to service layer

Rules:
- Only SQL/database logic here
- Do NOT apply business rules
- Services call repositories, not API routes
