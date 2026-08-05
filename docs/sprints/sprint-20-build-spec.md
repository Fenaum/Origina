# Sprint 20 — Build Spec (OUTLINE — pre-draft, two milestones out)
## Platform SLO, Security Round 3 + Milestone 4 Gate

> **Status:** outline (pre-draft). Refine to DRAFT during M3; promote at the M3 gate (Sprint 15.4).
> **Milestone:** [M4 — Platform](MILESTONES.md) (sprint 5 of 5 — **gate sprint**)
> **Sprint goal:** The external surface is measurable and defensible. Milestone closes with UAT-4.

## Planned phases (outline)

- **20.1 SLO definition + instrumentation:** SLIs for `/api/ext` (uptime, p95 latency, error rate), error budget, alerting, a status page (a simple one is fine). Honest framing: the roadmap metric "SLO met for a quarter" is *proven* in the quarter after the gate — this sprint proves the **measurement exists and is trustworthy**.
- **20.2 Load & abuse testing:** rate-limit behavior under burst, key brute-force lockout, webhook SSRF guards (subscription URLs must not reach internal/private IP ranges), replay protection on signed deliveries.
- **20.3 Hardening buffer + M4 debt sweep:** deliberately thin phase — this is the scope pressure valve that absorbs slip from Sprints 16–19 (operating rule 5) without moving the gate.
- **20.4 UAT-4 + M4 gate review:** gate review recorded in MILESTONES.md; plan M5 sprints (21–25) with what the milestone taught us.

## Gate — UAT-4 (owner + partner)

An external consumer runs a full lifecycle **purely over keys/SDK/webhooks**: create draft loan → docs attached → status tracked via webhooks → status/audit read via SDK. Quota enforcement and key revocation demonstrated live. DLQ replay demonstrated. SLO dashboard live with ≥1 week of real data. Exit: zero open P0/P1; partner (or reference app) integration in production.

## Key decisions (ADRs)

SLO targets (pick numbers we can defend, not aspirational ones) · status-page hosting · incident response basics (who gets paged — even if "who" is one person).

## B-gates (sketch)

Burst-load test passes without 5xx leakage · SSRF guard test (webhook to `169.254.x.x`/`10.x` rejected) · revoked key dies within one request · UAT-4 executed, findings logged as BUG entries.
