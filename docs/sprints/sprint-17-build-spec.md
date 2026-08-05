# Sprint 17 — Build Spec (OUTLINE — pre-draft, two milestones out)
## Event Platform & Async Jobs

> **Status:** outline (pre-draft). Refine to DRAFT during M3; promote at the M3 gate (Sprint 15.4).
> **Milestone:** [M4 — Platform](MILESTONES.md) (sprint 2 of 5)
> **Sprint goal:** Webhooks become reliable enough for a partner to build a business process on — real background worker, full event catalog, dead-letter + replay. Also completes the last AI prerequisite from the AI Scope ADR (S3 ✅ Sprint 7, domain events ✅ Sprint 4, **async jobs ← this sprint**).

## Planned phases (outline)

- **17.1 Async job runner:** move outbox dispatch out of the request process into a dedicated worker. ADR first: Postgres-backed worker (`FOR UPDATE SKIP LOCKED` polling) vs Celery/RQ — bias toward Postgres-backed, no new infrastructure dependency.
- **17.2 Event catalog expansion:** `loan.created`, `condition.status_changed`, `document.uploaded`, `decision.issued`, `exception.decided` join `loan.submitted`/`loan.status_changed`. One consumer, one file per transport — the CLAUDE.md commitment holds.
- **17.3 Delivery guarantees:** retries with exponential backoff + jitter, dead-letter table after N failures, admin replay/redelivery, delivery log with response codes and timing.
- **17.4 Subscription management UI:** tenant admin creates/pauses subscriptions, picks event types, rotates HMAC secrets, fires a test delivery.

## Key decisions (ADRs)

Job runner technology (the big one — this worker later runs AI jobs, SLA timers, and exports) · at-least-once semantics + published consumer-idempotency guidance · webhook payload versioning (inherits the 16.1 policy).

## B-gates (sketch)

Worker killed mid-delivery loses zero events (outbox row survives, redelivers) · DLQ replay integration test · HMAC signature round-trip · payload schema snapshot tests so payloads can't drift silently.
