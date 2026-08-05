# SLA Engine & Async Jobs — Architecture Plan

> **Status:** blueprint (2026-07-19). Makes the ADR calls deferred in
> [sprint-12-build-spec.md](sprints/sprint-12-build-spec.md). Related:
> [DISCLOSURES_COMPLIANCE_ARCHITECTURE.md](DISCLOSURES_COMPLIANCE_ARCHITECTURE.md) (shares the
> sweeper + calendar), [ORG_BROKER_AUTHZ_ARCHITECTURE.md](ORG_BROKER_AUTHZ_ARCHITECTURE.md)
> (escalation targets).

---

## ADR-1: Timers are rows; the scheduler is a stateless ticker

The central call. **No timer state lives in memory.** `sla_timers` rows carry `due_at`; a sweep
is one query (`due_at < now() AND status = 'running'`, `FOR UPDATE SKIP LOCKED`, batched). The
"scheduler" is only a heartbeat that runs the sweep — APScheduler in-process for v1, started in
the FastAPI lifespan, interval ~30s.

Why this shape: restarts lose nothing (rows persist), horizontal scaling needs nothing
(SKIP LOCKED makes concurrent sweepers safe), and the growth path to a dedicated worker is
*moving the ticker*, not redesigning state. The same sweep loop services SLA breaches **and**
compliance-obligation overdue detection (one generic pass over "dated rows that flip state and
emit an event") — build it once as `services/sweeper.py` with registered sweep targets.

## ADR-2: Clock semantics — wall clock stored, business-hours computed at start

`sla_rules.calendar` TEXT CHECK: `wall / business_days / business_hours`. `due_at` is always a
concrete stored timestamp computed **once at timer start** via the shared
`services/business_calendar.py` (same service as disclosures; holidays are tenant config).
No runtime "is it business hours" math in the sweeper — recompute `due_at` only if the rule or
trigger changes. Default seeded rules use `business_days`; confirm semantics with a lender at
UAT-2 per the spec, but the schema already covers all three answers.

## The rule → timer lifecycle

```
sla_rules (tenant config; a config-platform namespace, medium tier)
  id · tenant_id · name · active
  trigger_event TEXT        -- outbox event type, e.g. loan.status_changed
  trigger_filter JSONB      -- e.g. {"to_status": "submitted"}
  satisfy_event TEXT · satisfy_filter JSONB
  duration_minutes int · calendar TEXT
  escalate_to TEXT          -- role | team_lead | branch_manager | user:<id>  (resolved via Sprint 11 org)

sla_timers
  id · tenant_id · loan_id · rule_id
  status TEXT CHECK: running / satisfied / breached / cancelled
  started_at · due_at · resolved_at
  breach_notified bool
```

`sla_consumer.py` (one consumer, one file — the CLAUDE.md commitment) reads the outbox:
matching `trigger_event` starts a timer; matching `satisfy_event` resolves it
(`satisfied` with time-to-resolution retained — this is the analytics gold). The sweeper flips
overdue running timers to `breached` and emits `sla.breached`. Terminal loan statuses cancel
open timers (a rule shouldn't breach on a withdrawn file).

Escalation resolution happens at *notification* time, not rule-authoring time: `sla.breached` →
`notification_consumer` resolves `escalate_to` against the current org hierarchy (assignee's
team lead today, whoever holds that seat tomorrow). Rules never store user ids except explicit
`user:<id>` pins.

## ADR-3: Delivery — notifications table is truth; SSE is a push hint

- `notifications` table (append-only): recipient, kind, title, body, link, `read_at`. Written by
  `notification_consumer` for every routed event (SLA breach, assignment, decision issued…).
- `GET /api/v1/notifications` (paginated envelope) + mark-read. The bell/panel UI reads this.
- **SSE** (`/notifications/stream`), not WebSocket (one-directional; ADR per spec) — but SSE only
  pushes "you have new rows"; the client refetches the table. If SSE dies behind a proxy, React
  Query polling (60s) is the automatic fallback — same code path, no divergent delivery logic.
- Per-user channel preferences (in-app / email / both) in existing user settings; the consumer
  checks preferences before SMTP (which stays `NOTIFICATIONS_ENABLED`-gated).

## Growth path (recorded now so nobody re-decides it)

v1: APScheduler ticker in-process + consumers invoked post-commit (current outbox pattern).
v2 (when needed — first symptom: sweep latency or event backlog): a dedicated worker process
running *the same* `sweeper.py` and consumer files against the same tables; the web app stops
ticking via one env flag. Redis/queue infrastructure is **not** adopted until v2 proves
insufficient — the outbox table *is* the queue, and it's already there. This is the M4
"event platform + async jobs" on-ramp: M4 generalizes this runner; it doesn't replace it.

## Sequencing (Sprint 12 as spec'd, sharpened)

1. 12.1: migrations (`sla_rules`, `sla_timers`) · `business_calendar.py` · `sweeper.py` ·
   `sla_consumer.py` · seed 3 starter rules (submitted→conditions_review 48h business;
   condition outstanding >7d; decision expiring in 5d).
2. 12.2: `notifications` table + consumer routing + preferences.
3. 12.3: SSE endpoint + bell UI + polling fallback.
4. Tests per spec B-gates, plus: concurrent sweepers don't double-fire (SKIP LOCKED test) ·
   terminal status cancels timers · business-day due-date math (shared fixtures with the
   compliance tests).

**Out of scope:** business-hours *pausing* (clock stops nights/weekends mid-timer — real but
rare ask; schema field reserved) · cross-tenant SLA benchmarks · a general workflow/BPMN engine
(explicitly rejected — same reasoning as the no-BRMS position in CONFIG_AND_DECISION_PLATFORM.md).
