# Disclosures & Compliance Timeline — Architecture Plan

> **Status:** blueprint (2026-07-19). Fills the roadmap gap: disclosures appear in no sprint
> through 20 (explicitly out-of-scope in Sprint 9) yet the `loans` table already carries four
> disclosure date columns. Related: [SLA_WORKFLOW_ENGINE_ARCHITECTURE.md](SLA_WORKFLOW_ENGINE_ARCHITECTURE.md)
> (shared timer substrate), [PRICING_DECISION_FUNDING_PLAN.md](PRICING_DECISION_FUNDING_PLAN.md) (gates).

---

## Framing decision: two compliance profiles, one architecture

Non-QM cuts across the key regulatory line. Business-purpose DSCR loans are generally
**TRID-exempt**; consumer-purpose Non-QM (bank statement, asset depletion for a primary home)
is fully TRID-bound (LE within 3 business days of application, CD 3 business days before
consummation, redisclosure on changed circumstances). The architecture must serve both without
hardcoding either:

- `loans.compliance_profile` TEXT CHECK: `consumer_trid / business_exempt` — set at
  application from purpose + occupancy, editable by UW with reason (misclassification is itself
  a compliance event).
- The profile selects *which obligation templates instantiate*. Exempt loans aren't "no
  compliance" — tenants still track state-specific notices and internal policy docs; they just
  get a different, smaller template set.

## The obligation model (the core object)

An **obligation** = "this loan owes this artifact by this date, and here's the evidence."

```
obligation_templates (tenant-overridable, controlled-value idiom)
  code · name · compliance_profile · trigger_event TEXT   -- e.g. application.dated, decision.issued, funding.scheduled
  due_rule JSONB          -- {offset_days: 3, calendar: business, direction: after|before}
  evidence_kind TEXT CHECK: document / acknowledgment / date_entry
  blocking_edge TEXT NULL -- optional status edge this obligation gates, e.g. "approved->funded"

loan_obligations
  id · tenant_id · loan_id · template_code
  status TEXT CHECK: pending / satisfied / waived / overdue / cancelled
  trigger_at · due_at     -- computed once, recomputed if the trigger date moves
  satisfied_at · satisfied_by · waived_reason
  evidence_document_id NULL · superseded_by NULL          -- redisclosure chains

disclosure_events (append-only)
  id · tenant_id · loan_id · obligation_id
  kind TEXT CHECK: generated / sent / delivered / acknowledged / refused
  method TEXT CHECK: manual / email / portal · actor · occurred_at · metadata jsonb
```

Rules:

- **Tracking first, generation later.** v1 satisfies obligations by evidence: upload the LE/CD
  PDF (a Sprint 7 document with `doc_type` from a `disclosure_types` controlled-value set) and
  record the sent/acknowledged events. PDF *generation* is a separate, deferrable feature that
  slots in as just another producer of the same evidence — the model doesn't change.
- **Obligations instantiate from events**, not polling: a consumer file
  (`compliance_consumer.py`, per the one-consumer-one-file commitment) subscribes to the outbox
  (`application.dated`, `decision.issued`, `pricing_sheet.issued`, …) and instantiates/updates
  obligations per template.
- **Redisclosure = supersession.** A changed-circumstance signal (pricing sheet superseded with
  APR drift, fee lines changed on the funding worksheet — both already emit outbox events)
  creates a *new* obligation row linked via `superseded_by`. Never mutate a satisfied
  obligation; the chain is the audit story.

## Clocks: one business-calendar service, shared

`services/business_calendar.py`: `add_business_days(date, n, calendar)` with holidays as tenant
config (controlled values; seed US federal). This service is deliberately shared with the SLA
engine — disclosure due dates and SLA timers are the same math. Due dates are **stored** on the
obligation (queryable, indexable) and recomputed by the consumer when the trigger date changes.

**Overdue detection reuses the SLA sweeper** (see SLA plan): `loan_obligations` rows with
`due_at < now() AND status = 'pending'` flip to `overdue` and emit `obligation.overdue` — the
notification/escalation path is the SLA engine's, not a parallel one. This is the main reason
these two plans ship adjacently.

## Status integration (what makes it real)

Obligations with `blocking_edge` register as a **generic gate** in `transition_gates.py`:
`no_blocking_obligations(edge)` — e.g. the CD obligation on a `consumer_trid` loan blocks
`approved → funded` until satisfied; the same loan as `business_exempt` has no such obligation
and the gate passes vacuously. The gate framework needs zero compliance-specific code.
The four existing `loans.*_disclosure_date` columns become *derived displays* of obligation
satisfaction dates (kept in sync by the consumer; deprecate direct writes).

## Placement & sequencing

Recommend as **Sprint 13**, immediately after the SLA engine (12) whose substrate it reuses —
displacing SSO by one sprint (SSO is important but has no dependents; compliance gates get more
credible the longer live loans run without them). Decide at the M2 gate.

1. Migration set: `compliance_profile` column · templates + obligations + events tables ·
   seed template sets (TRID core for consumer; minimal notice set for exempt).
2. `compliance_consumer.py` + calendar service + gate registration.
3. Workspace "Compliance" section: obligation timeline (pending/satisfied/overdue), evidence
   attach, waive-with-reason (role-gated: underwriter/it_admin).
4. Tests: due-date math across weekends/holidays · profile selects template set · supersession
   chain on repricing · blocking obligation blocks the edge · exempt loan passes vacuously.

**Out of scope:** LE/CD PDF generation · e-sign/e-delivery integrations (the `disclosure_events.method`
enum is where they'll land) · HMDA reporting · state licensing rules engines · legal
interpretation — templates ship as *configurable defaults*, tenant compliance officers own them.
