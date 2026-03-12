# API Layer

This folder contains all route definitions (HTTP endpoints).

Responsibilities:
- Accept HTTP requests
- Validate user roles (RBAC)
- Parse request bodies with Pydantic schemas
- Call service layer
- Return standardized JSON responses

Rules:
- NO business logic here
- NO direct SQL or database interactions
- Keep routes thin and simple
