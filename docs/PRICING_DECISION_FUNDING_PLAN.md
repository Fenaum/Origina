# Pricing Sheet · Underwriting Decision · Funding Worksheet
## Integration Architecture Plan — making loan statuses mean something

> **Status:** proposed blueprint (2026-07-19). Extends the Sprint 9 and Sprint 10 build specs;
> the pricing sheet and the transition-gate framework are net-new. Related:
> [sprint-9-build-spec.md](sprints/sprint-9-build-spec.md), [sprint-10-build-spec.md](sprints/sprint-10-build-spec.md),
> [CONFIG_AND_DECISION_PLATFORM.md](CONFIG_AND_DECISION_PLATFORM.md), [DECISIONS.md](DECISIONS.md).

---

## 1. The problem

Today a status transition (`api/v1/status.py`) checks only the transition map — *ordering*, not
*readiness*. A loan can reach `funded` with zero cleared conditions, no documents, no decision,
and no worksheet. The three artifacts that should carry the meaning either don't exist or are
logs, not objects:

| Artifact | Today | Needed |
|---|---|---|
| Pricing | `pricing_runs` — append-only JSONB compute log, no lifecycle | **Pricing sheet**: versioned, issuable artifact the decision snapshots |
| Underwriting approval | A status flip; `decisions` table (migration 090 scope) unused as system of record | **Decision object**: issue/rescind/supersede, terms+pricing snapshot, expiration |
| Funding | A status flip | **Funding worksheet**: fee lines, per-diem, balance check, approval |

The unifying move: **statuses stay exactly as they are; the *edges* between them acquire gates.**
A transition fires only when the required artifacts exist in the required state. No new statuses,
no parallel state machine.

---

## 2. Core design: the transition-gate registry

One new service, `services/transition_gates.py`, owns a registry keyed by edge:

```python
GateResult = tuple[bool, str, str]          # (satisfied, code, detail)
GateCheck  = Callable[[Loan, Session], GateResult]

TRANSITION_GATES: dict[tuple[str, str], list[GateCheck]] = {
    ("submitted", "conditions_review"):     [application_complete],          # Sprint 8 gate slots in here
    ("conditions_review", "approved"):      [active_decision(APPROVE), pricing_sheet_current],
    ("conditions_review", "approved_pending"): [active_decision(APPROVE_WITH_CONDITIONS), pricing_sheet_current],
    ("approved_pending", "approved"):       [all_conditions_resolved],
    ("approved", "funded"):                 [all_conditions_resolved, decision_unexpired,
                                             funding_worksheet_approved, rate_lock_valid],
}

TRANSITION_ROLES: dict[tuple[str, str], frozenset[str]] = {
    ("conditions_review", "approved"):  frozenset({UNDERWRITER}),
    ("approved", "funded"):             frozenset({ACCOUNT_MANAGER, IT_ADMIN}),
    # unlisted edges: any authenticated user (current behavior, now explicit)
}
```

Rules:

- **One enforcement point.** `status.py`'s transition endpoint calls
  `evaluate_gates(loan, edge, db)` and returns `409` with the failing gate codes when blocked.
  `issue_decision()` and "mark funded" perform their status change *through* the same service —
  no second path around the gates. This also fixes the current gap where any authenticated user
  can approve or fund a loan (`TRANSITION_ROLES`).
- **Gates are discoverable, not just enforced.** `GET /loans/{id}/status` extends
  `available_transitions[]` with a `requirements` array
  (`[{code, label, satisfied, detail}]`). The workspace renders this as a readiness checklist —
  "what's blocking approval" — so the status becomes a promise the UI can explain.
- **Warn vs. block.** Each gate declares severity. `rate_lock_valid` warns (expired lock is a
  business call); `funding_worksheet_approved` blocks. Warnings require an explicit
  `override: true` in the transition request and are recorded in the `loan_status_events` row.
- **Gates read, never write.** A gate is a pure predicate over existing tables (conditions
  counts, decision rows, worksheet status). No gate-specific persistence; the artifacts are the
  state.

This framework is small and has value *before* the artifacts exist: `all_conditions_resolved`
on `approved → funded` can ship immediately against the Sprint 2 condition lifecycle.

---

## 3. Pricing sheet (net-new)

Keep `pricing_runs` as the compute log. Add the human-issued artifact on top:

**Migration `132_pricing_sheets.sql`:**

```
pricing_sheets
  id uuid PK · tenant_id · loan_id FK
  version int                       -- monotone per loan
  status TEXT CHECK: draft / issued / superseded / expired / withdrawn
  pricing_run_id uuid NULL FK       -- provenance: which run produced it, if any
  base_rate numeric(5,3) · final_rate numeric(5,3)
  points numeric(6,3) · lender_credits numeric(12,2)
  input_snapshot jsonb              -- program, LTV, FICO, DSCR, doc type, lock period
  input_hash text                   -- staleness detection (same idiom as pricing_runs)
  prepared_by · issued_at · superseded_by uuid NULL FK(pricing_sheets)

pricing_adjustments                 -- child table, ordered lines
  id · tenant_id · pricing_sheet_id FK
  code TEXT                         -- controlled value set 'pricing_adjustment_codes'
  label TEXT · bps int NULL · price_impact numeric(6,3) NULL · sort_order int
```

- **Lifecycle:** `draft → issued`; issuing a new version marks the prior `superseded`
  (chain via `superseded_by`, same pattern the decision object uses). Append-mostly: issued
  sheets are never edited, only superseded.
- **Staleness:** `input_hash` is recomputed from current `loan_financials` + `loan_terms` +
  program on read. Mismatch ⇒ sheet is *stale*; the `pricing_sheet_current` gate reports it and
  blocks approval until repriced or overridden.
- **Adjustment codes** live in `controlled_value_sets` (tenant-overridable, insert-only —
  no migration to add an LLPA line item). This is the on-ramp for the rules-engine future in
  [CONFIG_AND_DECISION_PLATFORM.md](CONFIG_AND_DECISION_PLATFORM.md): today a human keys the
  adjustments; later an engine emits the same rows. The schema doesn't change.
- API: `api/v1/pricing_sheets.py` (thin) + `services/pricing_sheet_repo.py`
  (create draft / issue / supersede / current-for-loan). Emits `pricing_sheet.issued` to the outbox.
- UI: workspace Underwriting tab gains a Pricing panel — current sheet, adjustment lines,
  version history, stale banner.

---

## 4. Underwriting decision (extends Sprint 10 Phase 10.1)

As spec'd in Sprint 10, with one integration added — **the decision pins the pricing sheet**:

**Migration `133_decisions_v2.sql`** extends `decisions`:

- `decision_type` TEXT CHECK: `approve / approve_with_conditions / suspend / deny / counteroffer`
- `status` TEXT CHECK: `active / rescinded / superseded / expired`
- `expiration_date`, `superseded_by`, `rescinded_by/at/reason`
- `terms_snapshot jsonb` — frozen copy of `loan_terms` + key `loan_financials` at issue time
- `pricing_sheet_id` FK — **must reference an `issued`, non-stale sheet**; the sheet's content
  is also embedded in `terms_snapshot` so the decision is reproducible even if pricing history
  is purged
- deny/counteroffer reasons: structured rows from controlled value set `decision_reasons`
  (fair-lending: mandatory, from vocabulary, not free text)

`services/decision_repo.py::issue_decision()` is one transaction:

```
validate gates → snapshot terms + pricing sheet → insert decision
→ supersede prior active decision → attach auto-generated conditions (Phase 10.2, draft-first)
→ status transition via transition_gates → emit decision.issued
```

`rescind_decision()` reverses the status to `conditions_review` (a normal gated edge) and marks
the decision `rescinded`. The `active_decision(type)` and `decision_unexpired` gates in §2 read
this table — approval and funding become *derived from the decision object*, not parallel to it.

---

## 5. Funding worksheet (extends Sprint 9 Phase 9.3)

As spec'd, tightened to the satellite-table pattern and the gate framework:

**Migration `134_loan_funding.sql`:**

```
loan_funding                        -- 1:1 satellite, loan_id PK (same as loan_financials/loan_terms)
  loan_id uuid PK FK · tenant_id
  status TEXT CHECK: draft / approved / funded
  wire_amount numeric(14,2) · disbursement_date date
  per_diem_interest numeric(10,2) · interest_from date · interest_to date
  approved_by · approved_at
  computed_total numeric(14,2)      -- denormalized for the balance check + audit trail

funding_fee_lines
  id · tenant_id · loan_id FK
  code TEXT                         -- controlled value set 'funding_fee_types'
  label · amount numeric(12,2) · paid_by TEXT CHECK: borrower/seller/lender/broker
  sort_order
```

- `services/funding_repo.py`: `compute()` (sum fee lines ± credits + per-diem vs. wire amount),
  `approve()` (role-gated AM/IT_ADMIN; requires balanced within tolerance), `mark_funded()`
  (calls the gated `approved → funded` transition; stamps `disbursement_date`).
- The **`funding_worksheet_approved` gate** is the only way `funded` is reachable:
  worksheet exists ∧ `status = approved` ∧ `|computed_total − wire_amount| ≤ tolerance`.
- Seed `funding_fee_types` (origination, underwriting, doc prep, title, escrow, recording,
  prepaid interest, broker comp…) as controlled values — tenant-extensible without migration.
- Attach the audit trigger to `loan_funding` (add to `_LOAN_ID_PK` array — PK is `loan_id`).
- UI: `WorkspaceFunding.tsx` — editor, live computed totals, imbalance banner, approve +
  mark-funded actions surfacing gate results from the status endpoint.

---

## 6. How the three integrate (the loan's paper trail)

```
pricing_runs (compute log)
      └─ produces → pricing_sheets v1 … vN  (issued, superseded chain)
                          └─ pinned by → decisions (active, terms+pricing snapshot)
                                              ├─ generates → conditions (templates, Phase 10.2)
                                              └─ gates → approved / approved_pending
conditions all resolved ─┐
decision unexpired ──────┼─ gates → funded ←─ gated also by ─ loan_funding (approved, balanced)
rate lock valid (warn) ──┘
```

Every artifact emits to the `domain_events` outbox (`pricing_sheet.issued`, `decision.issued`,
`decision.rescinded`, `funding.approved`, `loan.funded`) — SLA timers (Sprint 12), webhooks (M4),
and AI triggers subscribe later without touching this code. Routers stay thin; every rule above
lives in a service.

---

## 7. Sequencing & spec deltas

| Step | What | Lands where | Migration |
|---|---|---|---|
| A | Transition-gate registry + roles-per-edge + `requirements[]` in status endpoint; first gates: `all_conditions_resolved`, role gating | Small standalone PR — **can ship now**, pre-Sprint 8 | none |
| B | Pricing sheet (tables, service, routes, UW-tab panel) | **New Phase 10.0** in Sprint 10 (it's the decision's prerequisite) — or a mini-sprint 9.5 | 132 |
| C | Decision v2 + auto-conditions | Sprint 10 Phases 10.1–10.2 as spec'd + `pricing_sheet_id` delta | 133 |
| D | Funding worksheet + fee lines + gates | Sprint 9 Phase 9.3 as spec'd, using the Step-A framework instead of ad-hoc checks in `status.py` | 134 |

Spec deltas to record when adopted: Sprint 9 Phase 9.3 says "wire into `status.py` transition
validation" — replace with "register gates in `transition_gates.py`"; Sprint 10 Phase 10.1 adds
`pricing_sheet_id` + the staleness rule; both B-gate test lists gain
`tests/backend/test_transition_gates.py` (edge × gate matrix — blocked, satisfied, override,
role-denied) and `tests/backend/test_pricing_sheets.py` (issue/supersede/staleness).

**Out of scope (unchanged):** pricing/eligibility *engines* (humans key the sheet; the schema is
engine-ready), vendor integrations, disclosure generation, wire instructions/banking.
