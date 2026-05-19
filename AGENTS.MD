# AGENTS.md

This file gives coding agents concise instructions for working in the Origina repository.

For deeper architecture context, also read `CLAUDE.md`. This file is intentionally shorter and optimized for implementation agents such as Codex.

## Project

Origina is a Non-QM Loan Origination System and TPO platform.

Stack:
- Backend: FastAPI, Python, SQLAlchemy 2.x
- Database: PostgreSQL
- Frontend: Next.js, TypeScript, React, Tailwind CSS 4, shadcn/ui

## Agent Roles

Use Claude Code primarily for:
- complex architecture decisions
- domain modeling
- workflow design
- refactoring strategy
- technical tradeoff analysis

Use Codex primarily for:
- repetitive implementation
- CRUD endpoints
- schema/model updates
- route wiring
- frontend component implementation
- small refactors
- command execution and validation

## Commands

### Backend

```bash
cd src/backend
uvicorn app.core.main:app --reload