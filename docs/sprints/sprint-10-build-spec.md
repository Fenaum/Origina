# Sprint 10 — Implementation Spec
## Decisioning First-Class + Milestone 2 Gate

> **For:** any LLM/developer implementing this sprint · **Validated by:** Claude Code after completion
> **Milestone:** [M2 — Operational Depth](MILESTONES.md) (sprint 5 of 5 — **gate sprint**)
> **Sprint goal:** Underwriting decisions become durable, auditable objects with condition auto-generation from templates — and the milestone closes with UAT-2: a full start-to-fund run by a non-developer.
> **Prerequisite:** Sprints 6–9 complete (decision needs application + docs + milestones + funding to gate against).

---

## Phase 10.1 — Decision as First-Class Object

Migration 090 (`decisions`) exists; this phase makes it the system of record:

- Migration: extend `decisions` as needed — decision type (approve/approve-with-conditions/suspend/deny/counteroffer), expiration date, rate/terms snapshot at decision time (JSONB snapshot of `loan_terms` + key financials — decisions must be reproducible even after terms change), superseded_by chain for re-decisions.
- `services/decision_repo.py`: `issue_decision()` (atomic: decision row + status transition + conditions attach + `decision.issued` outbox event), `rescind_decision()`, decision history query. Router thin (`api/v1/decisions.py`) — this is the platform-boundary pattern (logic in services) done right from day one.
- `WorkspaceUnderwriting.tsx`: decision panel upgrades — issue with type/expiration/notes, history timeline, rescind with reason. Deny/counteroffer capture reasons (fair-lending: reasons are mandatory, structured, from a controlled-value set).

## Phase 10.2 — Condition Auto-Generation

- Migration: `condition_templates` gains program/decision-type applicability (tenant-overridable). Seed per Non-QM program: DSCR (lease agreements, rent schedule), Bank Statement (12/24-mo statements), Asset Depletion (asset verification), etc.
- On `issue_decision(approve_with_conditions)`: instantiate applicable templates as `outstanding` conditions (respecting the Sprint 2 lifecycle state machine), deduped against manually-added ones. UW reviews/prunes the generated list *before* the decision commits — generation is a draft list in the decision form, not a silent write (advisory-first, same rule as doc auto-linking).

## Phase 10.3 — M2 Hardening + UAT-2 Gate

1. Write `docs/END_USER_TEST_SCRIPTS.md` **UAT-2 script**: URLA create → docs upload/auto-link → milestones complete → decision issue (auto-conditions) → conditions clear → funding worksheet → `funded`. One script per role where flows differ.
2. Owner runs UAT-2; findings logged as BUG entries; P0/P1 fixed **inside this sprint** (gate doesn't close red).
3. Coverage check: gates still ≥70%/≥90% with all M2 code; raise the API gate if headroom allows (record decision either way).
4. Milestone review in MILESTONES.md: gate verdict, metrics, what rolls to Sprint 11 — then promote the M3 draft specs (11–15) to implementable with what UAT-2 taught us.

## B-Gate Tests (Sprint 10)

- [ ] `tests/backend/test_decision_lifecycle.py` — issue/rescind/supersede; terms snapshot immutable; deny requires structured reasons; events emitted
- [ ] `tests/backend/test_condition_autogen.py` — right templates per program/decision type; dedupe; UW prune respected; lifecycle rules hold
- [ ] `tests/backend/test_full_lifecycle_e2e.py` — **the milestone test**: one loan travels application → docs → milestones → decision → conditions cleared → funded, entirely through the API
- [ ] Vitest: decision panel issue + history; auto-generated condition review list
- [ ] UAT-2 executed, zero open P0/P1
- [ ] Green CI run URL: _(paste at close)_

## Out of scope

Eligibility/pricing *rules engines* (M5 — decisions are human-made here; the object model is deliberately engine-ready) · automated underwriting · investor delivery.
