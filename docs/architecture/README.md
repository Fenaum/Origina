# Origina LOS — Architecture Index

System diagram and index. Open a specific file for detail.

> **Related docs:** [PMO.md](../PMO.md) | [DECISIONS.md](../DECISIONS.md) | [ROADMAP.md](../ROADMAP.md) | [BUILD_HISTORY.md](../BUILD_HISTORY.md) | [DATA_DICTIONARY](../Data-Dictionary/DATA_DICTIONARY.md) | [UX_PRINCIPLES.md](../UX_PRINCIPLES.md)

---

## System Diagram

```
Browser (Next.js 16 — page router, TypeScript strict)
  ├── Auth: JWT in localStorage → apiClient.ts injects Bearer header
  ├── React Query: QueryClientProvider at app root (Phase 1+)
  ├── Zustand stores: pipeline prefs, intake, recent loans, submission draft
  └── fetch() via apiClient.ts → service layer → hooks → components

FastAPI / Python (src/backend/)
  ├── 18+ routers, 100+ routes, all under /api/v1/
  ├── JWT auth (python-jose) + RBAC (require_roles dependency factory)
  ├── SQLAlchemy 2.0 ORM (session via Depends(get_db) or get_audited_db)
  └── PostgreSQL 15 (Docker in dev, AWS RDS in prod)

PostgreSQL
  ├── 125+ migrations (raw SQL, tracked by schema_migrations table)
  ├── TEXT + CHECK constraints (no PostgreSQL ENUM columns remain)
  ├── Audit triggers on 8 tables
  ├── controlled_value_sets + controlled_values (tenant-configurable metadata)
  └── Multi-tenant: tenant_id on every table, enforced at query level
```

---

## Files in This Directory

- [backend.md](backend.md) — FastAPI layers, session management, schemas, RBAC, multi-tenancy
- [database.md](database.md) — Migration strategy, loan split, controlled values, audit triggers
- [frontend.md](frontend.md) — Next.js structure, state stores, data flow, type conventions
- [loan-workspace.md](loan-workspace.md) — Loan workspace layout, section nav, WorkspaceHome
- [exceptions.md](exceptions.md) — Exception module tables, lifecycle, authority rules, 25 routes
- [integrations.md](integrations.md) — Current integrations, planned, scalability considerations
- [settings.md](settings.md) — Settings module plan: IA, URL structure, components, migrations, phases
- [feature-guides.md](feature-guides.md) — Checklists for adding endpoints, tables, pages, controlled values

---

## Documentation Maintenance Rules

- Update the migration sequence in [database.md](database.md) every time a new migration is applied.
- Update the integration status table in [integrations.md](integrations.md) when a new system is wired.
- Update the sections table in [loan-workspace.md](loan-workspace.md) when workspace sections change.
- Cross-reference [DECISIONS.md](../DECISIONS.md) for the *why* behind any architectural choice.
- Current implementation only — future plans belong in [ROADMAP.md](../ROADMAP.md).
