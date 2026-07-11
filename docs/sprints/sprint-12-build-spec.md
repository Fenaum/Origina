# Sprint 12 — Build Spec (DRAFT — refine at M2 gate)
## SLA Engine & Real-Time Notifications

> **Status:** rolling-wave draft. Promote during Sprint 11.
> **Milestone:** [M3 — Enterprise-Ready](MILESTONES.md) (sprint 2 of 5)
> **Sprint goal:** Time becomes a first-class citizen: tenants define SLA rules ("submitted files must reach conditions_review in 48h"), breaches escalate through the org hierarchy (Sprint 11), and users see events in an in-app notification center without refreshing.

## Planned phases

- **12.1 SLA engine:** `sla_rules` (tenant-defined: trigger event/status, duration, escalation target) + `sla_timers` (instance per loan, started/paused/breached). Consumes the `domain_events` outbox (this is exactly the "SLA timers subscribe as additional consumer files" commitment in CLAUDE.md — one consumer file, `sla_consumer.py`). Timer sweep via a scheduled job — **this sprint introduces the async-job runner** (likely APScheduler in-process first; ADR for the eventual worker split).
- **12.2 Escalation + notification routing:** breach → `sla.breached` event → notification to the escalation target (person/team/branch manager from Sprint 11 hierarchy). Notification preferences per user (email / in-app / both) under Settings.
- **12.3 In-app notification center:** `notifications` table + SSE endpoint (`/api/v1/notifications/stream`) + bell/panel UI in TopHeader. SSE, not WebSocket — one-directional is all this needs (ADR).

## Key decisions (ADRs)

Async-job runner choice and its growth path to a separate worker · SSE vs polling fallback behavior behind proxies · SLA clock semantics (business hours vs wall clock — ask a lender during UAT-2).

## B-gates (draft)

Timer lifecycle (start/satisfy/breach) from real outbox events · escalation lands with the right person · SSE delivers within N seconds in an integration test · notification preferences respected.
