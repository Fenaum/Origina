# Origina PMO — Initiative Portfolio

> **Related docs:** [PROGRAM_STRATEGY.md](PROGRAM_STRATEGY.md) | [ROADMAP.md](ROADMAP.md) | [CURRENT_SPRINT.md](CURRENT_SPRINT.md) | [REQUIREMENTS.md](REQUIREMENTS.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [TESTING.md](TESTING.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md)

This is the Program Management Office view for Origina. Use it to track initiatives as a portfolio instead of treating each feature as a standalone task.

## Phase Legend

| Phase | Meaning |
|---|---|
| Discovery | Problem, scope, users, and risks are being clarified |
| Design | UX, data model, architecture, and acceptance criteria are being shaped |
| Build | Implementation is actively underway |
| Testing | Implementation exists and is being hardened against acceptance tests |
| Released | Shipped into the working demo/product path |

## Portfolio Snapshot

| Initiative | Current phase | Owner | Architecture status | Test coverage | Primary risk |
|---|---|---|---|---|---|
| Authentication, RBAC, and User Administration | Build | Codex / AI engineering lead | Partially real; DB role source still in progress | Sprint 1 auth tests green; Sprint 2 RBAC tests pending | Role vocabulary drift and unsafe admin paths |
| Loan Pipeline and Workspace Core | Build | Codex / AI engineering lead | Real pipeline API; workspace partially wired | Pagination and workspace home tests green | Workspace sections remain unevenly real vs placeholder |
| Conditions and Workflow State Machines | Design | Codex / AI workflow lead | Routes exist; lifecycle service planned | Lifecycle and UI tests pending | Invalid transitions without server-side enforcement |
| Borrower Intake and Loan Submission | Released | Codex / AI product engineering lead | End-to-end demo path real with some simulated dependencies | Submission tests green; multi-tenant tests partly skipped | Pricing, MISMO, and notifications are still stubs |
| Analytics and Reporting | Build | Codex / AI analytics lead | Real analytics surface with saved views and drilldowns | Smoke/UI coverage exists indirectly; deeper reporting tests pending | Reporting can outgrow current query and cache strategy |
| Settings and Admin Configuration | Build | Codex / AI platform lead | Frontend structure exists; backend persistence partial | Coverage pending | UI can imply configurability that backend does not yet persist |
| Documents, MISMO, Pricing, and External Integrations | Discovery | Codex / AI integration lead | Mostly stubbed or simulated | Coverage pending | Integration complexity, storage security, and vendor boundaries |
| Enterprise Platform Readiness | Discovery | Codex / AI architecture lead | Long-term roadmap only | Coverage pending | Starting platform/API work before pilot workflow is proven |
| Quality, CI, and Technical Debt Control | Build | Codex / AI quality lead | Test harness exists; CI gates not complete | 19 backend + 4 frontend tests passing, 2 skipped as of July 2026 roadmap | Debt grows faster than regression coverage |

## Initiative Details

### Authentication, RBAC, and User Administration

| Field | Status |
|---|---|
| Vision | Every user logs in with a real account, carries DB-backed roles, and sees only the workflows their role should access. |
| Business case | Required for credible lender demos, multi-user workflows, tenant isolation, and any production path. |
| Success metrics | Broker, underwriter, processor, AE/AM, and admin demo accounts work; `/users/me` hydrates from JWT; admin-only user creation enforced; all RBAC tests green. |
| Dependencies | Users/RBAC tables, JWT auth, role constants, frontend auth state, sidebar/page guards. |
| Risks | Role names differ between frontend and backend; user creation currently needs tightening; localStorage token storage remains demo-only. |
| Current phase | Build |
| Owner | Codex / AI engineering lead |
| Architecture status | JWT and protected routes are live; role assignment and DB-backed role hydration are Sprint 2 work. |
| Test coverage | `test_auth_secret_from_env.py` green; `test_user_rbac.py` planned. |
| Technical debt | Move auth from localStorage to httpOnly cookies before production; normalize role vocabulary everywhere. |
| Future enhancements | Password reset, SSO/OIDC, session management, tenant onboarding, custom roles. |

### Loan Pipeline and Workspace Core

| Field | Status |
|---|---|
| Vision | Give operations teams a fast, trustworthy command center for finding, opening, and acting on every loan. |
| Business case | The pipeline and workspace are the daily operating surface for wholesale LOS users. |
| Success metrics | Paginated pipeline loads real tenant-scoped loans; workspace home shows real financials and terms; users can move from queue to action without leaving the file. |
| Dependencies | Loan header/financials/terms split, loan detail APIs, frontend hooks, role guards, seeded Non-QM loans. |
| Risks | Some workspace sections are placeholders; `getLoanById` still has a scaling smell; assignment fields are incomplete. |
| Current phase | Build |
| Owner | Codex / AI engineering lead |
| Architecture status | Pipeline API and workspace shell are real; section-by-section domain wiring remains in progress. |
| Test coverage | `test_pagination_envelope.py`, `test_loan_financials_endpoint.py`, and `WorkspaceHome.test.tsx` green. |
| Technical debt | Other list endpoints still need pagination envelopes; workspace detail should stop relying on large pipeline fetches. |
| Future enhancements | Assignment columns, priority, bulk actions, right-side activity panel, inline edits, status transition UI. |

### Conditions and Workflow State Machines

| Field | Status |
|---|---|
| Vision | Conditions move through a controlled lifecycle with clear authority, auditability, and UI feedback. |
| Business case | Condition management is central to underwriting and borrower/broker communication in Non-QM lending. |
| Success metrics | Valid transitions are accepted; invalid transitions return 422/409; clear/waive/reject actions are audited; workspace UI reflects status accurately. |
| Dependencies | Conditions table, condition routes, audited DB writes, task/template UI, role model. |
| Risks | Lifecycle rules can be bypassed if PATCH status remains available; rejection reason uses deferred schema debt. |
| Current phase | Design |
| Owner | Codex / AI workflow lead |
| Architecture status | Base routes exist; dedicated `condition_lifecycle.py` service planned in Sprint 2. |
| Test coverage | `test_condition_lifecycle.py` and `WorkspaceConditions.test.tsx` planned. |
| Technical debt | Move business logic out of routers; add dedicated rejection reason column later. |
| Future enhancements | Borrower-facing condition view, document-condition linking, notification triggers, SLA rules. |

### Borrower Intake and Loan Submission

| Field | Status |
|---|---|
| Vision | Borrowers and brokers can start a Non-QM scenario, receive useful program guidance, and submit a loan into the LOS path. |
| Business case | Intake is the top-of-funnel engine for TPO and direct borrower workflows. |
| Success metrics | Borrower completes intake; program ranking appears; handoff is stored; AE can submit a new loan and see it in pipeline. |
| Dependencies | Anonymous intake tables, ranking endpoint, submission store, loan creation APIs, financials/terms APIs. |
| Risks | Pricing is illustrative, MISMO parsing is stubbed, document upload is simulated. |
| Current phase | Released |
| Owner | Codex / AI product engineering lead |
| Architecture status | End-to-end demo path works; dependent integrations are intentionally deferred. |
| Test coverage | `test_loan_submission_e2e.py` green except multi-tenant skipped case. |
| Technical debt | Multi-tenant test seed needs second tenant; pricing and MISMO need real service boundaries. |
| Future enhancements | Save/resume intake, co-borrower flow, real pricing, MISMO parser, broker notification. |

### Analytics and Reporting

| Field | Status |
|---|---|
| Vision | Give managers and operators a live view of pipeline volume, risk, action needs, and throughput. |
| Business case | Visibility and reporting are key differentiators against legacy LOS workflows. |
| Success metrics | KPIs, charts, trends, and drilldowns load from real data; filters are explainable; exports support business reviews. |
| Dependencies | Analytics APIs, saved views, pipeline data quality, chart components, date and role filters. |
| Risks | Reporting needs can expand faster than the current query model; exports and role-specific dashboards are not done. |
| Current phase | Build |
| Owner | Codex / AI analytics lead |
| Architecture status | Analytics route and visual refresh are live; deeper reporting layer remains planned. |
| Test coverage | Basic frontend coverage exists elsewhere; dedicated analytics regression tests pending. |
| Technical debt | Add React Query conventions for server-state caching; add query performance checks as data grows. |
| Future enhancements | Date filters, manager dashboard, PDF/image export, funnel conversion, forecasting. |

### Settings and Admin Configuration

| Field | Status |
|---|---|
| Vision | Admins configure users, products, workflow, controlled values, and tenant preferences without code changes. |
| Business case | Configuration is required for multi-tenant lender adoption and operational independence. |
| Success metrics | Settings pages persist changes to backend; controlled values are tenant-aware; admin-only paths are enforced. |
| Dependencies | Controlled values metadata API, tenant settings, user admin, settings frontend. |
| Risks | Frontend can outrun backend persistence; admin permissions must be strict before real tenant use. |
| Current phase | Build |
| Owner | Codex / AI platform lead |
| Architecture status | Settings IA and frontend exist; persistence is incomplete by area. |
| Test coverage | Dedicated settings/admin tests pending. |
| Technical debt | `@shadcn/ui` dummy package remains; shared UI primitives need a clean setup. |
| Future enhancements | Tenant branding, product configuration, workflow templates, audit retention settings. |

### Documents, MISMO, Pricing, and External Integrations

| Field | Status |
|---|---|
| Vision | Origina connects safely to the external systems and file workflows lenders need around the LOS. |
| Business case | Real lending operations depend on documents, pricing, automated import, notifications, and downstream integrations. |
| Success metrics | Documents are stored securely; MISMO imports real files; pricing is sourced from a defined engine/vendor; integration boundaries are documented and tested. |
| Dependencies | S3 or equivalent storage, async jobs, domain events/outbox, vendor decisions, audit/security model. |
| Risks | Storage security, vendor complexity, regulatory exposure, and premature platform work. |
| Current phase | Discovery |
| Owner | Codex / AI integration lead |
| Architecture status | Integration architecture documented at a high level; most implementations are stubs. |
| Test coverage | Pending. |
| Technical debt | Document upload and MISMO are simulated; pricing scenarios are hardcoded. |
| Future enhancements | S3 storage, document classification, MISMO parser, pricing adapter, email/SMS notifications, CRM sync. |

### Enterprise Platform Readiness

| Field | Status |
|---|---|
| Vision | Prepare Origina for multiple lenders, partner APIs, audit requirements, and future platform integrations. |
| Business case | Enterprise readiness turns the prototype into a scalable lender platform. |
| Success metrics | Three or more tenants supported; SSO live; audit export and retention are defined; first read-only partner API ships. |
| Dependencies | Pilot workflow closure, domain events, audit log strategy, tenant onboarding, CI, security hardening. |
| Risks | Building platform surfaces before core lender workflow is proven. |
| Current phase | Discovery |
| Owner | Codex / AI architecture lead |
| Architecture status | Long-term phase roadmap exists; implementation deferred until Pilot-Ready closes. |
| Test coverage | Pending. |
| Technical debt | Audit log partitioning ADR needed before large-scale use. |
| Future enhancements | API keys, webhooks, SDK, SSO, org hierarchy, SLA engine, SOC 2 groundwork. |

### Quality, CI, and Technical Debt Control

| Field | Status |
|---|---|
| Vision | Every milestone ships with tests, known debt is visible, and regressions are caught before demos. |
| Business case | Long-running multi-initiative work needs guardrails or velocity turns into rework. |
| Success metrics | `scripts/run_tests.sh` green; B-gate tests block completion; skipped tests trend to zero; CI blocks red PRs. |
| Dependencies | Backend pytest harness, frontend Vitest harness, seed fixtures, CI runner, roadmap definition of done. |
| Risks | New features may land without matching tests; skipped multi-tenant tests can hide isolation bugs. |
| Current phase | Build |
| Owner | Codex / AI quality lead |
| Architecture status | Harness exists; CI/coverage gates are still being matured. |
| Test coverage | 19 backend + 4 frontend tests passing, 2 skipped as documented in `ROADMAP.md`. |
| Technical debt | Multi-tenant seed fixtures, backend coverage gate, frontend smoke gate, regression tests from build history. |
| Future enhancements | PR CI enforcement, coverage thresholds, test impact map, release checklist. |

## Maintenance Rules

- Update this PMO page when an initiative changes phase, owner, risk profile, architecture status, or coverage status.
- Keep initiative details at portfolio altitude; implementation task lists belong in [CURRENT_SPRINT.md](CURRENT_SPRINT.md) or sprint specs.
- When an initiative ships, update its phase here, then move completed task-level items in [ROADMAP.md](ROADMAP.md).
- New initiatives should use the same fields: Vision, Business case, Success metrics, Dependencies, Risks, Current phase, Owner, Architecture status, Test coverage, Technical debt, Future enhancements.
