# Sprint 16 — Build Spec (OUTLINE — pre-draft, two milestones out)
## UAT-3 Response & External API GA

> **Status:** outline (pre-draft). Refine to DRAFT during M3; promote to implementable at the M3 gate (Sprint 15.4). Expect this to change — it is a planning artifact, not a commitment.
> **Milestone:** [M4 — Platform](MILESTONES.md) (sprint 1 of 5)
> **Sprint goal:** UAT-3 findings burned down, and the Sprint 15 read-only preview becomes a dependable product surface — versioned, documented, observable.

## Planned phases (outline)

- **16.0 UAT-3 burn-down + M3 debt closeout:** reserved phase, per the standing pattern (Sprint 6 Phase 6.0 / operating rule 2). P0/P1 findings from UAT-3 auto-scope here; unfixed P2s go to the tech-debt table.
- **16.1 Versioning & deprecation policy:** the external-API versioning ADR (drafted in Sprint 15) becomes enforced policy — public API changelog, contract-freeze rules for `/api/ext/v1`, standardized error shape. CI fails on an undocumented breaking change to the external OpenAPI spec.
- **16.2 Read surface expansion:** conditions, document metadata, borrower summary added to the external read API — gated by an explicit **external PII policy** (fields a machine key can never read; SSN/DOB-class data stays internal, full stop).
- **16.3 API observability & quotas:** per-key request logging, latency/error metrics, quota tiers (per-key or per-tenant — decide), admin usage dashboard so a tenant admin can see what their keys are doing.
- **16.4 (conditional) Production deployment baseline:** M4's gate requires an SLO, and an SLO requires a deployed environment. If M3 did not deliver hosting/deploy, it lands here and 16.2/16.3 slip to Sprint 17.

## Key decisions (ADRs)

External PII exposure policy (write it before the first field ships) · standardized external error format · quota model (per-key vs per-tenant) · hosting/deployment target if 16.4 activates.

## B-gates (sketch)

Contract-diff check red on undocumented breaking change · PII-restricted fields provably absent from external responses · quota enforcement returns 429 with retry hints · every UAT-3 bug has a named regression test.
