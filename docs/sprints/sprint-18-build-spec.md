# Sprint 18 — Build Spec (OUTLINE — pre-draft, two milestones out)
## Write API v1 (Guarded)

> **Status:** outline (pre-draft). Refine to DRAFT during M3; promote at the M3 gate (Sprint 15.4).
> **Milestone:** [M4 — Platform](MILESTONES.md) (sprint 3 of 5)
> **Sprint goal:** First external writes, scoped to the CRM-handoff use case — create a draft loan, attach documents and notes. The standing rule is honored: the read-only API will have run for a full milestone before the first write ships. Decisioning and status transitions are **permanently** out of machine-auth scope.

## Planned phases (outline)

- **18.1 Write scopes + machine actor auditing:** `loans:write`, `documents:write`, `notes:write` key scopes; audit attribution for machine actors (ADR — extend the `app.current_user_id` trigger pattern so `audit_log` records *which key* acted, not a null actor).
- **18.2 Write endpoints:** create draft loan (atomic header + financials + terms, reusing the internal submission service — routers stay thin), add note, presigned document upload. Explicit non-goals in the spec: no status transitions, no decisions, no condition mutations via external API.
- **18.3 Idempotency + safety:** `Idempotency-Key` header support (storage + TTL decision), forked external Pydantic schemas per the Sprint 15 ADR, separate (tighter) write rate limits per key.
- **18.4 Sandbox mode:** a sandbox flag so partners integrate without touching real pipeline data — likely a flagged tenant rather than a separate environment (decide).

## Key decisions (ADRs)

Machine-actor audit attribution · idempotency storage + TTL · sandbox = flagged tenant vs separate environment · the *permanent* exclusion list for machine auth (decisioning, status, conditions) — write it down so nobody relitigates it per-endpoint.

## B-gates (sketch)

Double-POST with same Idempotency-Key creates exactly one loan · write with read-only key → 403 · machine write appears in `audit_log` attributed to the key · sandbox data invisible to production pipeline/analytics queries · cross-tenant write attempt → 404, never 403-with-existence-leak.
