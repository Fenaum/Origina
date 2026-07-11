# Sprint 11 — Build Spec (DRAFT — refine at M2 gate)
## Org Hierarchy & Custom Roles

> **Status:** rolling-wave draft. Promote to implementable detail during Sprint 10 Phase 10.3, using UAT-2 findings.
> **Milestone:** [M3 — Enterprise-Ready](MILESTONES.md) (sprint 1 of 5)
> **Sprint goal:** A tenant has internal structure — branches and teams — and can define its own roles over a fixed permission vocabulary. Pipeline visibility follows the org chart.

## Planned phases

- **11.1 Org model:** migrations for `branches` + `teams` (+ `user_team_memberships`); users/loans gain optional branch/team attribution; admin UI for org management under Settings → Admin.
- **11.2 Scoped visibility:** pipeline/analytics queries respect scope — a branch manager sees their branch, a team lead their team, tenant admins everything. Implemented as a query-scope service (one place computes the visible-loan filter), not per-endpoint conditionals.
- **11.3 Custom roles:** fixed permission vocabulary (curated set of `domain:action` permissions derived from existing `require_roles` usage) + tenant-defined roles as permission bundles. The five system roles become seeded bundles; `require_roles` migrates to `require_permission`. **This is the riskiest refactor of M3 — the Sprint 6 RBAC matrix test is the safety net; extend it to permission-level assertions.**

## Key decisions to make at promotion time (ADRs)

- Permission vocabulary granularity (per-route is too fine; per-domain-verb is likely right)
- Whether loan assignment implies visibility regardless of team (probably yes — assignees always see their files)

## B-gates (draft)

Org CRUD + isolation · scope service unit tests (each org position sees exactly its slice) · RBAC matrix extended to custom roles · zero regressions in the existing role tests.
