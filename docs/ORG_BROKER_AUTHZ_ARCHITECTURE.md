# Org Hierarchy, Broker Channel & Data Visibility — Architecture Plan

> **Status:** blueprint (2026-07-19). Promotes the deferred decisions in
> [sprint-11-build-spec.md](sprints/sprint-11-build-spec.md) and adds the piece it omits
> entirely: **brokers** — Origina is a TPO platform and currently has no broker role, no broker
> company entity, and no answer to "which loans can this user see."

---

## The two axes (the decision that shapes everything)

Visibility has two independent axes, and conflating them is the classic retrofit disaster:

1. **Internal hierarchy** — branches and teams *inside* the lender. Managers see down the tree.
2. **External partner orgs** — broker companies *outside* the lender. Brokers see only their
   company's pipeline, ever, regardless of any tree.

Model them separately: `branches`/`teams` for axis 1 (per Sprint 11), a new `broker_companies`
table for axis 2. Do **not** model broker companies as branches — they have different lifecycle
(approval/watchlist/termination), different data exposure rules, and will carry comp plans and
license data that internal org nodes never will.

## Schema (migrations land early — see sequencing)

```
branches        id · tenant_id · name · parent_branch_id NULL   -- shallow tree, depth ≤ 3 enforced in service
teams           id · tenant_id · branch_id · name
user_team_memberships   user_id · team_id · is_lead bool
users           + branch_id NULL · + broker_company_id NULL     -- exactly one axis per user; CHECK (NOT both)
broker_companies id · tenant_id · name · status TEXT CHECK: prospect/approved/watch/suspended/terminated
                 · nmls_id · approved_at
loans           + branch_id NULL · + team_id NULL · + broker_company_id NULL
```

`loans.broker_company_id` is attribution (whose file it is); `loan_parties` broker rows remain
the people. A broker user = `users` row with `broker_company_id` set and role `broker` (new
constant in `security/roles.py`). Same users table, same auth — no second identity system.

## The scope service (one place, composable)

`services/visibility.py::loan_scope_filter(user) -> ColumnElement` returns a SQLAlchemy
predicate; **every** loan-listing query composes it alongside the existing `tenant_id` filter.
Resolution, first match wins:

| Who | Sees |
|---|---|
| `it_admin`, `account_manager` (tenant-wide bundles) | all tenant loans |
| branch manager (`is_lead` at branch level / branch attribution) | loans in branch subtree |
| team lead / member | team's loans |
| broker user | `broker_company_id = user.broker_company_id` **only** |
| anyone | ∪ loans where they're the assignee (assignment always implies visibility — resolving Sprint 11's open question: **yes**) |

Rules: the service returns predicates, never lists of ids (scales, composable, testable by
asserting SQL). Analytics aggregates route through the same filter. No endpoint writes its own
scope conditional — that's the invariant the RBAC matrix test extends to cover.

## Permission vocabulary & custom roles (Sprint 11.3, decided)

- **Granularity: `domain:verb`**, ~25–30 permissions harvested from existing `require_roles`
  call sites (`loans:read`, `loans:transition`, `conditions:clear`, `decisions:issue`,
  `funding:approve`, `admin:org`, …). Per-route is unmaintainable; per-domain-verb matches how
  `TRANSITION_ROLES` in the gate registry already thinks.
- `permissions` (system-seeded, not tenant-writable) · `role_bundles` (tenant-overridable,
   the 5 system roles + `broker` seeded as bundles) · `role_bundle_permissions`.
- **Migration path:** `require_roles(...)` becomes a shim over `require_permission(...)` by
  mapping role constants → seeded bundles — call sites migrate opportunistically, nothing breaks
  on day one. The gate registry's `TRANSITION_ROLES` migrates to permission names in the same
  pass.

## Broker-facing surface: filtered *shapes*, not just filtered rows

Row scoping is not enough — a broker seeing their own loan must still not see internal notes,
underwriter identity, margin/comp internals. Rule: broker-facing responses use **separate
response schemas** (`LoanSummaryExternal`, `ConditionOutExternal`) — never the internal schema
with fields nulled out. v1 surface is the existing Next.js app with role-gated nav (pipeline +
loan status + conditions + document upload); a separate portal app is an M4 decision, and the
external schemas built here become the read shapes of the M4 partner API for free — same reason
the Sprint 7 borrower condition view is worth doing carefully.

## Sequencing

1. **Now (pre-Sprint 11, cheap):** add the nullable columns (`users.branch_id`,
   `users.broker_company_id`, `loans.branch_id/team_id/broker_company_id`) in a Sprint 8–10
   migration so backfill never blocks the feature. Add `broker` to role constants.
2. **Sprint 11.1–11.2 as spec'd** + `broker_companies` CRUD (Settings → Admin) and broker scope
   in the visibility service.
3. **Sprint 11.3** permissions per above; extend `test_rbac_coverage.py` to
   permission-level cells + a scope-matrix test (each org position × broker sees exactly its
   slice — the named B-gate).
4. Broker *onboarding workflow* (applications, docs, approvals) is its own later feature —
   the `status` column above is deliberately sufficient until then.

**Out of scope:** SSO (Sprint 13), comp plans / broker payouts, persons directory (see URLA plan
D2), cross-tenant anything.
