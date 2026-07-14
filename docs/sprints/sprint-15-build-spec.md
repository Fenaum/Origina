# Sprint 15 — Build Spec (DRAFT — refine at M2 gate)
## Read-Only API Preview + Milestone 3 Gate

> **Status:** rolling-wave draft. Promote during Sprint 14.
> **Milestone:** [M3 — Enterprise-Ready](MILESTONES.md) (sprint 5 of 5 — **gate sprint**)
> **Sprint goal:** The first external consumer can read loan status over a keyed API — the minimum-risk exercise of machine auth, versioning, and webhooks that M4 Platform will build on. Milestone closes with UAT-3.

## Planned phases

- **15.1 Machine auth:** `api_keys` table (tenant-scoped, hashed secret, scopes, expiry, last-used); admin UI to mint/revoke; key auth dependency parallel to `get_current_user` (never mixed on one route). Per the standing rule: **read-only scopes only** — `loans:read`, `status:read`, `audit:read`.
- **15.2 Read-only external API:** `/api/ext/v1/` namespace (separate from the app's `/api/v1/` — external contract gets its own versioning policy, ADR): loan status + status-event timeline, audit slice per loan, paginated envelope reused. Rate limiting per key. OpenAPI docs published for this namespace only.
- **15.3 First webhook:** webhook subscriptions (URL + secret + event types) consuming the outbox (`webhook_consumer.py` — one consumer, one file, per the CLAUDE.md commitment); HMAC-signed deliveries, retries with backoff, delivery log UI. Start with `loan.status_changed` only.
- **15.4 UAT-3 + M3 gate:** three-tenant concurrent simulation (isolation at UI/API/audit level), SSO round-trip, SLA breach alert live, audit export delivered, external key reads status. Gate review in MILESTONES.md; plan M4 sprints (16–20) with what the milestone taught us.

## Key decisions (ADRs)

External API versioning + deprecation policy (write before the first consumer exists, not after) · webhook retry/backoff semantics and dead-letter handling · whether `/api/ext` shares Pydantic schemas with internal or forks them (fork — external contracts must not drift when internal does).

## B-gates (draft)

Key lifecycle (mint/scope/expiry/revoke) · external endpoints reject session cookies and unscoped keys · webhook delivery + signature + retry-on-500 integration test · cross-tenant isolation proven at the external API · UAT-3 executed, zero open P0/P1.
