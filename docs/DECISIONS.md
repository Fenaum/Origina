# Origina LOS — Architecture Decision Records (ADR)

Captures every significant architectural choice made during development: what was decided, why, what was considered, and what it costs us. Read this before proposing changes to established patterns.

> **Cross-links:** [ARCHITECTURE.md](ARCHITECTURE.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md) | [ROADMAP.md](ROADMAP.md)

---

## Decision: Raw SQL Migrations, Not Alembic

**Date:** 2025 (initial setup)
**Status:** Accepted

**Context:**
The live database was initialized outside any migration runner. Alembic requires control from the very first table to generate safe auto-migrations. PostgreSQL-specific features (enum types, partial indexes, triggers, LATERAL JOINs) are poorly supported by Alembic's autogenerate.

**Decision:**
All schema changes go in numbered `.sql` files in `db/migrations/`. A custom runner (`scripts/init_db.py`) tracks applied files in the `schema_migrations` table and runs each file in its own `BEGIN/COMMIT` transaction.

**Reasoning:**
- SQL is explicit and reviewable — no ORM surprises
- Triggers, enum types, partial indexes, and LATERAL JOINs require raw SQL anyway
- Custom runner is ~50 lines and fully auditable
- Migration files serve as a complete schema changelog

**Alternatives Considered:**
- Alembic with `--autogenerate` — rejected; cannot handle existing DB state or PG-specific features
- Alembic with manual scripts — rejected; adds ceremony without benefit over raw SQL

**Consequences:**
- (+) Zero ORM-vs-DB surprises
- (+) Complete schema history in git
- (-) No automatic rollback support (must write DOWN migrations manually if needed)
- (-) Requires discipline on file numbering and not editing applied files

**Do not use `Base.metadata.create_all()`** — it cannot manage enum types, triggers, or historical migrations.

---

## Decision: PostgreSQL TEXT + CHECK Instead of ENUM Types

**Date:** 2026-06 (migrations 122–125)
**Status:** Accepted

**Context:**
The schema originally used PostgreSQL ENUM types for `loan_status`, `loan_purpose`, `borrower_type`, `condition_status`, `task_status`, `task_priority`, `loan_party_role`, and `party_type`. Adding a new ENUM value requires `ALTER TYPE ADD VALUE` which is **not transactional** — it commits immediately, cannot be rolled back, and cannot run inside the migration runner's `BEGIN/COMMIT` block.

For a multi-tenant SaaS platform where each lender may have custom workflow statuses or program names, per-migration schema changes to accommodate tenant variation are untenable.

**Decision:**
All ENUM columns converted to `TEXT` with `CHECK` constraints. Zero PostgreSQL ENUM columns remain (verified: `SELECT data_type FROM information_schema.columns WHERE data_type = 'USER-DEFINED'` → 0 rows after migration 125).

Python `str, Enum` classes in models replaced with plain class constants:
```python
class LoanStatus:
    NEW_DRAFT = "new_draft"
    SUBMITTED = "submitted"
    TERMINAL: frozenset[str] = frozenset({"denied", "withdrawn", "cancelled", "archived"})
    ALL: frozenset[str] = frozenset({...})
```

**Reasoning:**
- New status value = one transactional `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` (in-transaction)
- Tenant custom values = `INSERT INTO controlled_values` with `tenant_id = X` — zero schema change
- No `.value` boilerplate on plain class constants
- `frozenset` membership checks (`status in LoanStatus.TERMINAL`) read clearly

**Alternatives Considered:**
- Keep ENUM, add values out-of-band — rejected; breaks migration runner's transactional guarantee
- Validate only at application layer (no DB constraint) — rejected; loses DB-level integrity

**Consequences:**
- (+) New values added via transactional migration or `controlled_values` INSERT
- (+) Tenant customization without schema changes
- (+) No `ALTER TYPE` DDL complexity
- (-) CHECK constraints must be updated when the canonical set expands (one migration)
- (-) Slightly less self-documenting than ENUM in `\d tablename` output

---

## Decision: Controlled Values Table for Tenant Customization

**Date:** 2026-06 (migration 124)
**Status:** Accepted

**Context:**
After moving to TEXT + CHECK, values still need to be discoverable by frontends without hardcoding. Different tenants (lenders) may need custom labels, additional values, or different sort orders for the same code set (e.g., one lender calls `conditions_review` "Stips Needed").

**Decision:**
Two tables:
```sql
controlled_value_sets  -- set_code (PK), scope, description
controlled_values      -- set_code, tenant_id (nullable), code, label, sort_order,
                       -- is_active, metadata JSONB
                       -- UNIQUE NULLS NOT DISTINCT (set_code, tenant_id, code)
```

Rule: `tenant_id IS NULL` = system/global default. `tenant_id = X` = tenant override that shadows the system row at query time.

API: `GET /api/v1/metadata/values/{set_code}` merges system + tenant rows, returning only active values.

**Reasoning:**
- Adding a new value for all tenants: `INSERT ... (set_code, NULL, 'new_code', 'New Label')`
- Adding a value for one tenant: same insert with `tenant_id = their_uuid`
- Label overrides (tenant calls it something different): same `code`, tenant row, different `label`
- Zero migrations, zero deploys for tenant customization

**Alternatives Considered:**
- Per-tenant config JSON blob — rejected; no structure, no queryability
- Separate override tables per value set — rejected; explodes table count
- Hardcoded frontend maps — rejected; requires code deploy for any business rule change

**Consequences:**
- (+) Tenant customization without code changes or migrations
- (+) Backend and frontend can bootstrap from `GET /metadata/values` at startup
- (-) Frontend currently still uses hardcoded constants; must migrate to metadata endpoint
- (-) CHECK constraints and controlled_values must stay in sync (managed by convention)

---

## Decision: Single Exceptions Table with Nullable `loan_id`

**Date:** 2026-06 (migration 118)
**Status:** Accepted

**Context:**
Loan exceptions (guideline variances requiring approval) can occur before a loan file exists ("pre-file") — for example, an AE wanting to know in advance if a specific scenario will be approved. The original exceptions table had `loan_id NOT NULL`, blocking this use case.

Two architecture options were evaluated:
- **Option A:** Make `loan_id` nullable in the single exceptions table
- **Option B:** Separate `pre_file_exceptions` table, copy to `loan_exceptions` on link

**Decision:**
Option A. One `exceptions` table, `loan_id` nullable. Pre-file exceptions have `exception_source = "pre_file"` and `loan_id = NULL`. Linking an approved exception to a loan sets `loan_id` in-place and updates `exception_source = "loan_file"`.

**Reasoning:**
- Single record means complete history on one row — no copy/sync complexity
- Exception decisions, comments, and events travel with the original record
- The link action is reversible to audit via `exception_events` log entry

**Alternatives Considered:**
- Option B (separate table + copy) — rejected; duplicates the exception schema, complicates queries, breaks history continuity

**Consequences:**
- (+) All exception phases (pre-file, linked, decided) on one record
- (+) No copy logic; history is continuous
- (-) Queries for "all exceptions for a loan" must handle `loan_id IS NULL` correctly (already filtered by loan context)

---

## Decision: Loan Split Pattern (loans / loan_financials / loan_terms)

**Date:** 2025 (migrations 050, 108)
**Status:** Accepted

**Context:**
Loan data has three logical categories: header metadata (status, program, purpose), financial amounts (loan amount, LTV, FICO), and rate/term structure (interest rate, lock period, amortization). Putting all fields in one `loans` table creates a wide, hard-to-audit table. Using `loan_id` as PK on satellite tables enforces 1:1 at the DB level.

**Decision:**
- `loans` — header fields: status, purpose, program, assigned_to, dates
- `loan_financials` (`loan_id` PK+FK) — amounts: loan_amount, appraised_value, LTV, FICO, DTI, DSCR
- `loan_terms` (`loan_id` PK+FK) — rate structure: interest_rate, term_months, rate_type, lock_days

All three must be inserted atomically when creating a loan.

**Reasoning:**
- `loan_id` as PK enforces 1:1 at schema level without an extra surrogate key
- Clear separation of concerns; financials can change frequently without touching the loan header
- Audit triggers on `loan_financials` capture changes to amounts separately from status changes

**Consequences:**
- (+) Clean, auditable separation; 1:1 enforced by DB
- (+) Satellite tables can be updated atomically without touching loan header
- (-) Every loan fetch that needs financials requires a JOIN (acceptable; done in one query)
- (-) INSERT of a new loan requires 3 statements (managed in `loan_repo.py`)

---

## Decision: Loan Workspace Horizontal Navigation with `?section=` Params

**Date:** 2026 (Session 4)
**Status:** Accepted

**Context:**
A loan file has 13+ sections (Home, Processing, Underwriting, Conditions, Documents, Notes, URLA, HMDA, Exceptions, Tasks, Appraisal, Escrow, Title...). Options:
1. Separate routes (`/loans/[id]/processing`, `/loans/[id]/underwriting`, ...)
2. Single route with `?section=` query param
3. Client-side tab state (no URL)

**Decision:**
Single route `/loans/[id]` with `?section=` query param, shallow-pushed on nav. A "More" dropdown collapses less-used sections. The workspace layout (`LoanWorkspaceLayout`) uses no TopHeader — the loan's own sticky topbar serves as the page header.

**Reasoning:**
- Section links are shareable and deep-linkable
- No 15-page route explosion
- Back/forward navigation works correctly
- Shallow push means no full re-render on section change

**Alternatives Considered:**
- Separate routes per section — rejected; 13+ route files, navigation complexity
- Client-side only state — rejected; links not shareable, back button breaks

**Consequences:**
- (+) Shareable section URLs
- (+) One route file, one layout
- (-) `router.query.section` must be read with null-coalescing (SSR may return undefined)
- (-) `isWorkspaceSection()` guard needed to distinguish section params from other query params

---

## Decision: Event Sourcing for Loan Status

**Date:** 2025 (migration 073)
**Status:** Accepted

**Context:**
Regulatory compliance in mortgage requires a complete audit trail of every status transition: who changed it, when, from what, to what, and why. A single `loans.status` column holds the current state but loses history on every update.

**Decision:**
Dual-write pattern:
1. `loans.status` — current state (queryable, indexable)
2. `loan_status_events` (append-only) — every transition: `from_status`, `to_status`, `actor_user_id`, `reason`, `occurred_at`

Both must be updated atomically in the same transaction. The API enforces this in `status.py`.

**Reasoning:**
- Full compliance audit trail without reading `audit_log` (which is a diff log, not a business event log)
- `loan_status_events` is human-readable and directly usable for timeline UI
- `loans.status` remains queryable/indexable for pipeline filters

**Alternatives Considered:**
- `audit_log` only — rejected; `audit_log` stores JSON diffs, not business-level transitions
- No history, only current state — rejected; non-compliant

**Consequences:**
- (+) Full compliant status history
- (+) Directly usable for loan timeline/activity feed UI
- (-) Every status change requires 2 writes (atomic via transaction)
- (-) `loan_status_events` must be kept in sync with `loans.status` — managed by service layer, not by trigger

---

## Decision: JSONB for Audit Event Data and Exception Context

**Date:** 2025 (audit triggers) / 2026 (exceptions)
**Status:** Accepted

**Context:**
Two cases benefit from JSONB: audit log diffs (before/after values for any column on any table) and exception metadata (loan snapshot at time of request, compensating factors list, risk factor codes). These fields have variable structure that changes as features evolve.

**Decision:**
- `audit_log.before` / `audit_log.after` — JSONB. Trigger serializes the full row before and after each DML.
- `exceptions.compensating_factors` / `exceptions.risk_factors` — JSONB arrays
- `exceptions.loan_snapshot` — JSONB snapshot of key loan fields at exception creation time
- `exception_events.event_data` — JSONB for flexible per-event-type payload
- `controlled_values.metadata` — JSONB for set-specific extra fields (e.g., `retention_years` for document types)

**Reasoning:**
- Schema changes to the audited table don't break the audit trigger
- Exception structured fields evolve without migrations
- JSONB is indexable (GIN) when query patterns emerge

**Alternatives Considered:**
- EAV (entity-attribute-value) — rejected; no type safety, poor query performance
- Separate typed columns for every possible attribute — rejected; explosion of nullable columns

**Consequences:**
- (+) Flexibility without schema migrations
- (+) Trigger serializes full row regardless of which columns exist
- (-) No DB-level type enforcement on JSONB contents (application layer enforces)
- (-) JSONB queries require `->` / `->>` syntax; less readable than column access

---

## Decision: SSN Never Written to localStorage

**Date:** 2025 (initial submission flow)
**Status:** Accepted — **INVIOLABLE security invariant**

**Context:**
The loan submission form collects full SSN for borrower identity. Zustand's `persist` middleware writes store state to localStorage on every update. A bug or missing `partialize` config could accidentally persist SSN to localStorage, where it would be readable by any script on the page.

**Decision:**
`submissionStore.ts` uses `partialize` to explicitly strip `borrowers[].ssn` before any persist write:
```typescript
partialize: (state) => ({
  ...state,
  draft: {
    ...state.draft,
    borrowers: state.draft.borrowers.map((b) => ({ ...b, ssn: "" })),
  },
})
```
SSN lives in Zustand memory only during the session. On hydration, the SSN field is always empty — users must re-enter it.

**Reasoning:**
- Defense in depth: even if localStorage were exposed, SSN is not present
- Explicit stripping is more reliable than relying on developers to remember to exclude the field

**Consequences:**
- (+) SSN cannot leak via localStorage inspection or XSS cookie theft
- (-) Users must re-enter SSN after a page refresh (acceptable UX for a financial application)

---

## Decision: LATERAL JOIN for Pipeline Query

**Date:** 2026 (Session 3)
**Status:** Accepted

**Context:**
The pipeline grid needs: loan header fields + primary borrower name + subject property state + open/submitted condition counts. Fetching these via ORM would produce N+1 queries (one per loan for borrower, one per loan for property, one per loan for conditions).

**Decision:**
Single raw SQL query in `loan_repo.py` using LATERAL JOINs:
```sql
SELECT l.*, bor.full_name, prop.state, cond.open_count, cond.submitted_count
FROM loans l
LEFT JOIN LATERAL (SELECT first_name || ' ' || last_name AS full_name FROM borrowers WHERE loan_id = l.id AND type = 'primary_borrower' LIMIT 1) bor ON true
LEFT JOIN LATERAL (SELECT state FROM properties WHERE loan_id = l.id AND is_subject = true LIMIT 1) prop ON true
LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE status = 'open') AS open_count, COUNT(*) FILTER (WHERE status = 'submitted') AS submitted_count FROM conditions WHERE loan_id = l.id) cond ON true
WHERE l.tenant_id = :tenant_id
```

**Reasoning:**
- One round-trip regardless of pipeline size
- LATERAL is idiomatic PostgreSQL; no application-side aggregation needed
- Easily extended with additional LATERAL subqueries without changing the result shape

**Consequences:**
- (+) O(1) round-trips vs O(N) for ORM approach
- (+) Performant at 200+ loans
- (-) Raw SQL bypasses ORM; must manually keep in sync with schema changes
- (-) Harder to unit test than ORM queries

---

## Decision: Role-Based UI Architecture (Frontend)

**Date:** 2026 (auth wiring session)
**Status:** Accepted

**Context:**
Different user roles (broker, AE, underwriter, processor) see different sidebar items, dashboard pages, and feature access. Two options: single UI with conditional rendering, or separate page routes per role.

**Decision:**
Single UI with role-based conditional rendering, gated at three levels:
1. `<AppLayout allowedRoles={[...]}>` — page-level guard, redirects unauthorized users
2. Sidebar `roles` array on each nav item — hides entries for unauthorized roles
3. Component-level checks where needed for inline action buttons

**Reasoning:**
- Roles share most of the UI; separate routes would duplicate most pages
- `allowedRoles` on layout is a single-line declaration per page
- Sidebar config is a data array — easy to add/remove access without touching components

**Consequences:**
- (+) No route duplication; role access is declarative
- (+) Easy to audit which roles can access which pages (one config file)
- (-) Frontend role check is not a security boundary — backend RBAC is the real gate
- (-) Complex role-specific UI variations eventually push toward separate components

---

## Decision: AI Scope — Deferred, Not Excluded

**Date:** 2026-07-07 (quarterly architecture review)
**Status:** Accepted

**Context:**
Early project docs stated "No AI/ML features — intentionally out of scope," while the long-term product vision includes an AI platform layer (OCR, document classification, data extraction, loan summaries, guideline Q&A, risk scoring). These two statements contradicted each other and gave agents/developers conflicting direction.

**Decision:**
AI features are **deferred, not excluded**. No AI feature ships until the platform prerequisites exist, in this dependency order:
1. Real document storage (S3) — OCR needs durable, addressable bytes
2. Domain events layer — AI workers subscribe to events like "document uploaded"
3. Async job infrastructure — a `processing_jobs` table + worker loop (no Celery/Redis at current scale)
4. `ai_annotations` pattern — AI outputs stored alongside human data with `confidence`, `model_version`, `reviewed_by`; never overwriting human-entered values
5. Guideline corpus as versioned data — prerequisite for guideline Q&A and UW assistant

Planned AI sequence once prerequisites exist: document classification → data extraction with review UI → missing-document detection → loan summaries → guideline Q&A → risk scoring last.

**Reasoning:**
- The structured, tenant-scoped, audited data model already built is exactly the substrate AI features need — nothing built so far blocks the AI direction
- Human-in-the-loop review is a compliance requirement in mortgage, not a nice-to-have; the annotations pattern encodes that from day one
- Risk scoring is last because of fair-lending regulatory sensitivity — AI stays advisory, never auto-decisioning

**Consequences:**
- (+) One consistent answer for "should I build AI features now?" — no, but don't block them
- (+) Prerequisites double as platform infrastructure (events, jobs, S3) — no wasted work
- (-) The AI phase remains far out (est. Q4 2027); competitive pressure could force re-sequencing

---

## Decision: Domain Events via Transactional Outbox

**Date:** 2026-07-07 (quarterly architecture review — decided before Sprint 4 build)
**Status:** Accepted (implementation lands with Sprint 4 notifications)

**Context:**
Sprint 4 planned to send notification emails by calling SMTP directly inside the status-transition route handler. That works for one consumer but is the anti-pattern for a platform: every future consumer of "loan submitted" (webhooks, AI triggers, SLA timers, analytics invalidation) would need its own bespoke hook in the route.

**Decision:**
Introduce a `domain_events` append-only table (transactional outbox pattern):
- Columns: `event_type`, `entity_type`, `entity_id`, `tenant_id`, `payload` (JSONB), `occurred_at`, `processed_at`
- Route handlers/services write events **in the same transaction** as the state change — an event exists if and only if the state change committed
- A dispatcher (in-process at first, dedicated worker later) reads unprocessed events and fans out to consumers — email in Sprint 4; webhooks, AI job triggers, SLA timers later

**Reasoning:**
- Same-transaction write guarantees no lost or phantom events (vs. fire-and-forget after commit)
- Consumers are decoupled from producers — adding a webhook subscriber later requires zero changes to loan routes
- Follows the existing `AppendOnlyModel` pattern and the event-sourcing precedent set by `loan_status_events`
- Costs almost nothing now; retrofitting events under live consumers costs a rewrite

**Alternatives Considered:**
- Inline SMTP in route handlers — rejected; couples every event consumer into request handling, notification failure risk in the request path
- Message broker (Redis/RabbitMQ/Kafka) — rejected for now; operational overhead unjustified at current scale; the outbox table can feed a broker later without producer changes

**Consequences:**
- (+) Notifications, webhooks, AI triggers, and SLA timers all share one delivery mechanism
- (+) Events table doubles as a business-level activity feed
- (-) Dispatcher adds a polling loop (or LISTEN/NOTIFY) to operate and monitor
- (-) At-least-once delivery — consumers must be idempotent

---
---

## Decision: Capital Markets Scope Boundary

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted (scope for the PoC; Phase 3 MVP re-confirms)
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §1, §6, §14](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md)

**Context:**
Capital markets in a Non-QM lender is two distinct disciplines: the *origination side* (rate
sheets, eligibility, locks, best-execution, allocation, delivery, gain-on-sale) and the *quant
side* (DV01/convexity, OAS, prepayment/credit/severity models, MSR stochastic valuation, tranche
waterfalls). Mid-size Non-QM lenders today run the origination side in spreadsheets and buy the
quant side from specialist vendors (MCT, Intex, Yield Book, RiskSpan). No public vendor covers
both sides well. Origina's structural advantage is owning the *loan-level event stream* — the
same substrate that makes underwriting reproducible is what makes a lock aware of its loan's
material change.

**Decision:**
Build the origination-side capital-markets layer natively in Origina:
Rate Sheets → Locks → Eligibility / Best-execution → Allocation → Pool → Delivery → Gain-on-sale.

Integrate, do not build, the institutional quant layer. The seam is the
**pipeline-tape export + position import**: Origina exports `GET /v1/cm/pipeline-tape` (event-fresh
tape with snapshot hashes) and imports positions/coverage from the hedge advisor. Anything past
deterministic sheet-delta shocks (±25/50/100bp on rate-sheet rows) comes from outside the LOS.

**Reasoning:**
- The pricing-sheet substrate (migration 132 per PRICING_DECISION_FUNDING_PLAN.md) already
  carries the snapshot/hash/transition-gate idiom a lock needs — extending it is far cheaper than
  building a parallel artifact system
- Building DV01/OAS/MSR/waterfall math in-house is unsafe without a rates infrastructure team,
  would take many engineer-years, and would still lose to specialist vendors on coverage
- The LOS's structural advantage (event-driven staleness on the loan record) only matters on
  the origination side — quant math is portfolio-level and stateless w.r.t. individual loans
- "Defer, not exclude" — the AI Scope ADR is the precedent for not building a category that
  needs prerequisites we don't yet have

**Alternatives Considered:**
- Build the quant side first / alongside — rejected; unsafe, slow, blocks PoC
- Build only delivery & GoS, skip pre-funding (best-ex, allocation) — rejected; the value of the
  PoC is the connected loop on the loan record, not isolated post-close features
- Outsource the origination side too — rejected; loses the event-driven advantage that is the
  whole thesis

**Consequences:**
- (+) The PoC (§14) is buildable end-to-end on existing substrate with bounded scope
- (+) Every CM action (lock / reprice / allocate) is reproducible by construction — same
  reproducibility invariant as the pricing sheet
- (+) Quant features stay optional and bolt-on (Phase 3+), never a prerequisite for the
  origination side
- (-) Origina will never own its own rate-risk model — competitive posture requires a vendor
  partnership at MVP
- (-) "Pipeline tape" format is a contract we will live with — changes ripple to consumers

**Phase 3 / prod re-confirmation:** when the MVP (Phase 3) is scoped, this ADR is the boundary
that must hold. If a Phase-3 feature would require building quant math in-house, raise it as a
new ADR before committing.

---

## Decision: No In-House Rate-Risk Math

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §7.4, §14.1](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md)

**Context:**
Rate-risk math in capital markets includes interest-rate exposure (DV01, duration-weighted
pipeline exposure), convexity, scenario revaluation, margin-at-risk under model-based shocks,
OAS, prepayment/credit/severity models, MSR stochastic valuation, and securitization waterfall
math. These require a rates infrastructure (yield curves, swap curves, prepayment curves,
collateral performance data, model validation, model risk governance) that Origina does not
have and building it would consume many engineer-years that buy no differentiated capability —
specialist vendors cover this category better than any in-house team could at our scale.

**Decision:**
Origina does not compute rate-risk math in-house. Specifically:

- **Interest-rate exposure (DV01, duration-weighted pipeline):** pipeline tape is exported to
  the hedge advisor; coverage/positions are imported back. Origina never computes DV01.
- **Convexity, OAS, prepay/severity/MSR stochastic models, waterfall math:** never computed
  internally. Out of scope.
- **Scenario shocks:** v1 supports **deterministic sheet-delta shocks only** (±25/50/100bp on
  rate-sheet rows). Any result from these shocks is labeled `APPROXIMATE — deterministic shock,
  not a model-based revaluation`. Model-based shocks come from the hedge advisor.
- **Concentration risk:** *can* be computed in-house (threshold rules on investor share, product
  share, geography) — it is a count-and-compare, not rate-risk math.

**Reasoning:**
- Even large vendors specialize — Intex on deal analytics, MCT on hedge advisory, RiskSpan on
  prepayment — so even if we built it, we would lose to specialists
- Model risk governance (SR 11-7, fair-lending, model validation) is a regulatory cost we have
  not budgeted
- The PoC's purpose is to prove the architecture, not to compete with Bloomberg — proving we
  *don't* build this is part of the proof
- The deterministic-shock carve-out is a small, useful approximation that does not pretend to be
  a model; its label makes the boundary honest

**Alternatives Considered:**
- Build a minimal DV01 engine on top of a yield-curve library — rejected; curve maintenance and
  validation alone are full-time roles
- Buy a quant library and wrap it — rejected; the wrapping layer still requires model
  governance we don't have
- Skip rate exposure entirely in the PoC — accepted as the default; deterministic shocks are the
  optional demo-only control per §14.2

**Consequences:**
- (+) No model-risk governance burden
- (+) PoC scope stays small and shippable
- (+) Honest about what is approximation vs. what is not
- (-) Origina will always depend on an external vendor for rate-risk views; vendor risk becomes
  a product risk
- (-) The deterministic-shock carve-out is easy to misuse as if it were a model; labeling
  discipline becomes a product requirement

**Phase 3 / prod re-confirmation:** if a Phase-3 feature would require rate-risk math beyond
deterministic shocks, raise it as a new ADR before committing.

---

## Decision: Lock as Artifact (Not a Mutable Loan Status)

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §8 (Lock row), §14](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md); idiom from [PRICING_DECISION_FUNDING_PLAN.md §3](PRICING_DECISION_FUNDING_PLAN.md)

**Context:**
Today, the loan's lifecycle status (`loan_status` enum — `new_draft → submitted → ... →
funded → closed → post_closing → archived`) carries workflow meaning. A "lock" today is an
email or a spreadsheet cell — not a first-class object. A lock is, however, structurally
sibling to a pricing sheet: it carries the same needs (versioned, snapshot of inputs at
confirm-time, immutable core terms, lifecycle events, hash-verified reproducibility). A lock is
*not* a status — it has its own state machine (`requested → confirmed → (reprice_required ⇄) →
extended* → expired / cancelled / funded_delivered`) that does not map onto loan status cleanly.

**Decision:**
A lock is a first-class artifact, not a field on the loan and not a loan status.

- **Schema:** new `cm_locks` table (migration 135, per the §14.1 PoC cut). Core terms
  (`rate`, `base_price`, `adjusted_price`, `net_price`, `lock_period_days`, `locked_at`,
  `expires_at`) are **immutable after confirm**. Changes happen only via `cm_lock_events`
  (append-only, AppendOnlyModel) producing a new effective state.
- **Snapshot:** at confirm time, the loan's relevant fields (LTV, FICO, DSCR, doc type,
  property value, loan amount, etc.) are snapshotted into `loan_snapshot jsonb` and hashed
  (`snapshot_hash`) — same idiom as `pricing_runs.input_hash`. The hash is used to detect
  material change later (ADR 4).
- **Reproducibility:** pricing on a lock is computed **from the snapshot, not from live loan
  data**. This is the load-bearing acceptance criterion §14.3 #2.
- **Relocks:** a relock writes a new row chained via `prior_lock_id`; the prior row stays in
  its final state for audit.
- **Status interaction:** lock lifecycle does *not* move `loans.status`. Funding (which is a loan
  status transition) requires an active non-expired lock — enforced as a transition gate (see
  the `rate_lock_valid` gate from PRICING_DECISION_FUNDING_PLAN.md §2, repurposed).

**Reasoning:**
- Mirrors the pricing-sheet precedent — same snapshot/hash/supersession idiom means one mental
  model, not two
- Mutable fields on a loan create a class of bug ("did the rate come from the lock or from the
  loan?") that immutable artifacts eliminate
- The hash makes material-change detection a pure function: hash the current loan, compare to
  the lock's stored hash, decide
- Lifecycle events in an append-only table are auditable by construction — same as
  `loan_status_events`

**Alternatives Considered:**
- Store the lock as a status field on `loans` — rejected; loses snapshot, loses event chain,
  breaks the pricing-sheet idiom
- Store the lock in `pricing_runs` — rejected; pricing runs are a compute log, locks are an
  artifact; conflating them makes both less clear
- Mutable lock fields with optimistic concurrency — rejected; the bug surface is the same as
  mutable loan fields, and we already have the artifact idiom

**Consequences:**
- (+) Lock is reproducible from its own snapshot — PoC acceptance criterion §14.3 #2 holds
- (+) Material change is a hash compare — see ADR 4
- (+) Audit trail is the append-only `cm_lock_events` table — no separate audit code
- (-) One more first-class object to teach; counterparty/operations staff used to spreadsheet
  locks will need onboarding
- (-) Relock semantics (extend vs. relock) need explicit policy — PoC will hard-code the
  policy, Phase 3 lifts it to config per §20 (open questions, "Lock desk")

---

## Decision: Material-Change Registry as Versioned Config

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §6, §7.3, §14](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md); idiom from [CONFIG_AND_DECISION_PLATFORM.md](CONFIG_AND_DECISION_PLATFORM.md)

**Context:**
A "material change" today is whatever the lock desk decides it is on a given day — informal,
per-desk, not auditable. For PoC §14.3 #3 (FICO 700→678 flags a lock `reprice_required` and
raises an alert within one poll cycle), the system must enumerate which loan fields affect
pricing, what tolerance bands apply, and what severity (warn vs. block) each change has.
Hard-coding this in Python means every policy tweak is a deploy — untenable for a regulated
lender.

**Decision:**
The material-change registry is **versioned config**, not code.

- **Schema:** `cm_material_change_registry` table (migration 135) holds rows of
  `(field_name, impact: 'rate' | 'price' | 'eligibility' | 'best_ex_rank', tolerance: jsonb,
  severity: 'warn' | 'block', version: int, effective_from/to)`. The seed ships ~8–12 fields
  covering the FICO×LTV LLPA grid, DSCR band, doc type, loan amount, property value, occupancy,
  purpose, and rate-sheet-version mismatch.
- **Eval:** when a locked loan's relevant fields change (detected by comparing current
  computed `input_hash` to the lock's `snapshot_hash`), the registry is consulted to decide
  whether the change crosses a tolerance, and what severity flag the lock receives.
- **Versioning:** every config edit increments `version`; the lock snapshot stores the
  registry version it was evaluated against, so historical "what did the system consider
  material" is replayable.
- **Tenant shadowing:** follows the existing `controlled_values` shadowing pattern (see ADR
  "Controlled Values Table for Tenant Customization") — system defaults at `tenant_id IS NULL`,
  tenant overrides shadow at `tenant_id = X`. No new shadowing mechanism is introduced.
- **UI/admin:** PoC ships a read-only viewer. Admin editing UI is Phase 3 per the doc's
  Phase 3 backlog.

**Reasoning:**
- Policy that changes weekly must not require a deploy weekly
- Storing the version alongside the lock snapshot is what makes the "why was this flagged"
  question answerable later (regulatory / fair-lending)
- Reusing the controlled-values shadowing pattern means one tenant-customization story, not two
- Phase 3 can layer a full editor on the same table — no schema rewrite

**Alternatives Considered:**
- Hard-code the field list in Python — rejected; not auditable, not tenant-customizable, not
  replayable
- Embed the registry inside `pricing_runs.input_snapshot` — rejected; the registry is shared
  across locks, runs, and (later) decisions; embedding fragments the source of truth
- Use a code-side DSL (e.g. Pydantic + validators per field) — rejected; drifts from policy
  edits, harder to version, harder to shadow

**Consequences:**
- (+) Policy edits do not require a deploy
- (+) Replayability: "what was this lock flagged for, under what rule version?" is a SQL query
- (+) Tenant customization reuses an existing, audited pattern
- (-) A new config table to teach and document
- (-) Bad edits can be deployed without code review — operational guardrails (review on
  version bump, effective-from/to) become the safety net

**Phase 3 / prod re-confirmation:** the editor UI lands in Phase 3. Until then, changes go
through a migration (same review path as schema changes).

---

## Decision: Investor Overlays via Shadowing

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §6, §8 (InvestorOverlay row)](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md)

**Context:**
Each investor has guidelines overlaid on Origina's base product guidelines — sometimes
tighter (max LTV 70 vs. base 75), sometimes looser (min FICO 660 vs. base 680), sometimes
new (reserve months = 6, not in base). Today this lives in investor-specific spreadsheets.
In Origina, the same problem already exists for tenant customization of controlled values and
was solved by shadowing: system rows at `tenant_id IS NULL`, tenant rows at `tenant_id = X`
that shadow at query time. Investor overlays are the same pattern one level up — system
(base product guidelines) shadowed by investor overlays — and should reuse the idiom rather
than invent a parallel mechanism.

**Decision:**
Investor overlays shadow base guidelines using the **same shadowing pattern as
`controlled_values`** (see ADR "Controlled Values Table for Tenant Customization"):

- **Schema:** `cm_investor_overlays` (migration 135) holds overlay rows with a validated
  rule expression (jsonb schema: `{rule_code, op, value, severity}`), `investor_program_id`
  FK, version, effective window. Overlays apply *on top of* the base guideline result.
- **Eval order:** base guideline is evaluated first; overlay rules are then applied in
  declared order. A loan passes an investor program iff it passes base + all overlays for that
  program.
- **Audit:** eligibility results (ADR "Event Sourcing for Loan Status" precedent for
  append-only evidence) persist the full rule trace — which base rule passed, which overlay
  rule passed/failed, and which overlay version was active.
- **Tenant customization:** if a tenant wants to disable an overlay or add their own (e.g. a
  captive investor not in the system set), that goes through the existing tenant-shadowing
  layer on `cm_investor_overlays` (`tenant_id IS NULL` default, `tenant_id = X` override).

**Reasoning:**
- One shadowing pattern is easier to teach, audit, and extend than two
- The append-only eligibility result gives auditors the same kind of evidence the existing
  `loan_status_events` gives for status transitions — same precedent, same shape
- Versioned overlays mean a guideline change does not retroactively change historical
  eligibility decisions

**Alternatives Considered:**
- Build a separate overlay engine — rejected; duplicates the shadowing pattern we already have
- Encode overlays as Python rules per investor — rejected; not auditable, not replayable, not
  tenant-shareable
- Store overlays only as free-form notes — rejected; loses the deterministic, testable
  evaluation the rest of the system depends on

**Consequences:**
- (+) One mental model for "shadow X with Y at a higher level" — applies to controlled values,
  investor overlays, and (future) per-tenant investor lists
- (+) Eligibility results are replayable per snapshot hash + overlay version
- (-) The shadowing query grows; mitigated by indexes on `(tenant_id, set_code, code)` per the
  existing controlled-values pattern
- (-) Misconfigured overlays can silently loosen eligibility — operator review of new overlay
  versions is mandatory

---

## Decision: Capital Markets Stays in the Monolith

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §6.1, §14](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md)

**Context:**
Capital markets has many of the smells that historically motivate service extraction: real-time
position updates, streaming market data, complex computations, and a "platform" feel. But
Origina's current scale is 1–2 full-stack engineers; spinning up a separate CM service adds
deployment, observability, auth, and contract-maintenance cost that buys no capability the
PoC needs. The architecture doc is explicit that the seam for *future* extraction exists
already in the substrate — the `domain_events` outbox and the versioned snapshot hashes.

**Decision:**
CM is built **inside the existing FastAPI monolith** as a package-boundary module:

- **Backend layout:** `src/backend/app/services/cm/*_repo.py` for business logic;
  `src/backend/app/api/v1/cm.py` (and small sub-routers) for thin routes — follows the existing
  repo convention (services suffixed `_repo.py`, routers thin per CLAUDE.md).
- **Events:** all CM events flow through the existing `domain_events` outbox (see ADR "Domain
  Events via Transactional Outbox"). No new message broker, no new infrastructure.
- **Data:** CM tables (`cm_*`) live in the same PostgreSQL database, in the same `tenant_id`
  isolation regime, with the existing audit trigger (`log_audit_event()`) attached to mutating
  tables.
- **Future extraction seam:** if Phase 3+ ever needs to extract CM, the seam is the
  `domain_events` outbox + the public `/cm/*` API surface — both are versioned contracts today.

**Reasoning:**
- CLAUDE.md and the architecture doc both call out monolith-with-package-boundaries as the
  current house style
- The outbox pattern is explicitly designed to be the future extraction seam — building it
  now and extracting later is cheaper than building a separate service now and merging later
- No CM feature in the §14 PoC needs lower latency or higher throughput than the rest of the
  monolith already serves

**Alternatives Considered:**
- New FastAPI microservice for CM — rejected; doubles deploy surface, splits auth/tenant/audit
  concerns, no current scale justification
- Add Redis/Kafka for CM events — rejected; the outbox table is the broker for now (same
  reasoning as ADR "Domain Events via Transactional Outbox")
- Shared library consumed by both LOS and a future CM service — rejected; speculative,
  duplicates dependency surface, no consumer yet

**Consequences:**
- (+) Zero new infrastructure for the PoC
- (+) Same audit / tenant / RBAC posture as the rest of the LOS — no security-review delta
- (+) Future extraction is a well-bounded project, not a rewrite
- (-) All CM load goes through the same FastAPI workers — if CM becomes hot, scaling becomes
  monolith-scaling, not CM-scaling
- (-) "Extract later" is a deferred cost; if Phase 3 hits a real reason to extract, it lands as
  a planned project, not a surprise

**Phase 3 / prod re-confirmation:** if Phase 3 introduces streaming market data or sub-second
position updates, revisit this ADR — those are the load-bearing reasons to extract.

---

## Decision: Calculation Ownership Map (One Implementation Per Calc)

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §7](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md) (owner column)

**Context:**
The architecture doc enumerates ~25 capital-markets calculations (rate, price, LLPA, SRP,
eligibility, best-ex net, allocation variance, pool WA, DV01, etc.) and assigns each an
*owner*: AN (analytics, simple deterministic), CMS (capital-markets service, in-house), or
EXT (external vendor). Today nothing enforces this — any module can compute anything, and
silent divergences (the UI shows one number, the persisted record shows another) are the most
expensive class of bug in finance software. The reproducibility invariant (ADR 8) depends on
having one source of truth per number.

**Decision:**
The §7 owner column is **normative**. Each calculation has exactly one implementation, and
analytics/UI read the persisted result — they never re-derive.

- **CMS-owned calcs** (rate/price/LLPA/SRP/best-ex net/eligibility/pool WA/concentration) live
  in `services/cm/*_repo.py` and persist into `cm_*` tables (migrations 135–139).
- **AN-owned calcs** (deterministic shocks, pull-through, roll-forward forecast) live in the
  existing analytics services and persist into the analytics tables.
- **EXT-owned calcs** (DV01, OAS, prepay, MSR, waterfall) are **never computed internally** —
  results are imported from the external system and stored as opaque snapshots with a
  provenance field (`source`, `source_version`, `received_at`).
- **No second implementation.** If a UI needs to display a calc result, it reads the persisted
  row. Re-computing in the frontend, in a reporting query, or in a background job is a bug.
- **Test enforcement:** the PoC test slice (§18 in the architecture doc) includes a check that
  the persisted result equals a re-computation from the snapshot for every CMS calc — same
  golden-file discipline as pricing today.

**Reasoning:**
- "Two implementations that diverge" is the canonical finance-software bug — preventing it
  requires a single owner
- Persisting snapshots is what makes results replayable (ADR 8) — re-computation breaks
  reproducibility the moment any input changes
- The owner map is already drawn in §7; making it normative means writing it down once and
  enforcing it everywhere, not re-litigating per feature

**Alternatives Considered:**
- Allow multiple implementations and reconcile — rejected; reconciliation is more expensive
  than prevention at our scale, and the divergence is rarely discovered before reporting
- Make everything CMS-owned — rejected; the EXT column exists for regulatory and capability
  reasons (ADR 2)
- Make everything AN-owned (move CMS into analytics) — rejected; the pricing-sheet substrate
  lives in CMS-land; moving it loses the snapshot/hash idiom

**Consequences:**
- (+) Numbers in the UI are the same numbers in the persisted record — no class of "why does
  the screen say X but the audit log says Y" bug
- (+) Reproducibility (ADR 8) is enforceable in tests, not aspirational
- (+) §7's owner map becomes a checklist for new CM features, not a suggestion
- (-) Analytics/UI developers must read from the persisted result — slightly more friction
  than computing inline
- (-) Adding a new calc requires a one-line owner assignment; if skipped, a code-review check
  has to catch it

---

## Decision: Reproducibility as a CI-Enforced Invariant

**Date:** 2026-08-04 (Sprint 7, off-sprint PoC window)
**Status:** Accepted
**Source:** [CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §7.3, §11, §14.3](CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md); idiom from [PRICING_DECISION_FUNDING_PLAN.md §3](PRICING_DECISION_FUNDING_PLAN.md)

**Context:**
A priced lock that can't be replayed from its snapshot is a compliance and dispute-resolution
liability — "what was the rate on this lock at the time, and why?" must be answerable from
the system alone, with no recourse to email or spreadsheet. The pricing-sheet plan established
the snapshot/hash/supersession idiom; the architecture doc explicitly carries it forward and
adds the CI-enforcement layer: a regression that breaks replay must block release.

**Decision:**
**Reproducibility is a CI-enforced invariant**, not an aspiration.

- **Per-decision persistence:** every priced / ranked / allocated decision persists
  `(input_snapshot jsonb, input_hash text, snapshot_versions jsonb, calc_version text)`.
  `snapshot_versions` records the version of every config it depended on (rate-sheet version,
  LLPA grid version, material-change registry version, eligibility-rule version,
  investor-program version, overlay version). The hash covers the canonical input set;
  `snapshot_versions` is the human-readable companion for auditors.
- **Replay function:** every CMS-owned calc exposes a `replay(snapshot) -> result` function that
  takes only the snapshot (not the live DB) and returns the original result. The PoC ships one
  per calc type.
- **CI gate:** a test suite replays a sample of historical decisions across all CMS calcs and
  asserts the replayed result matches the persisted result to a documented tolerance. A
  failure blocks the build (same gate pattern as the pricing-sheet plan's `--cov-fail-under`
  thresholds — see Sprint 5 spec).
- **Tolerance:** exact-match for rate/price/best-ex-net/eligibility; tolerance band (e.g.
  floating-point epsilon) only for derived stats like pool WA, and the band is documented in
  the test.
- **Scope:** applies to CMS-owned calcs only. EXT calcs (ADR 2) are opaque snapshots — replay
  for them means "the import was re-run with the same source bytes," which is a different
  (and Phase 3+) concern.

**Reasoning:**
- The pricing-sheet idiom has already proven it works for one artifact; extending it is the
  cheapest path to the same property for the rest of CM
- "Reproducible by construction" beats "reproducible if you have the same spreadsheet" for
  audit, dispute resolution, and (later) regulatory examination
- CI enforcement prevents the invariant from decaying — the first "I'll skip the snapshot, this
  is just an internal calc" exception is the one that becomes a permanent footgun
- Tolerance bands (rather than exact match) for derived stats keep the gate useful as the math
  evolves (e.g. WA rounding rules)

**Alternatives Considered:**
- Document the requirement, skip the CI gate — rejected; the first drift will be silent and
  discovered in production
- Replay against the live DB — rejected; that's not replay, it's re-execution; the snapshot
  hash is the whole point
- Replay only for locks, not for best-ex or allocation — rejected; the property is most
  valuable exactly where the dispute risk is highest (best-ex ranking, allocation override)

**Consequences:**
- (+) Every CMS decision is replayable from its own snapshot — auditors and dispute resolution
  work from the system, not from spreadsheets
- (+) CI catches drift the moment a calc changes — fixes land before they reach prod
- (+) The snapshot set is the natural export seam for §7.4 EXT integrations (Phase 3+)
- (-) Replay tests must be updated when calcs legitimately change — the test files become
  golden files that must be reviewed alongside the calc change
- (-) The CI replay suite grows with every calc — budgeted test time increases; mitigated by
  keeping the sample size bounded (e.g. one per calc type per release) and running the full
  historical replay only nightly

**Phase 3 / prod re-confirmation:** the EXT-import replay path becomes its own ADR when the
first hedge-advisor integration is scoped.

---

## Documentation Maintenance Rules

- **Add an ADR for every decision that would surprise a new developer.**
- **Update Status to `Deprecated` (never delete) when a decision is reversed** — add a "Superseded by" line pointing to the new ADR.
- **Date field:** use the date the decision was made or first implemented, not the date it was documented.
- **Keep the Consequences section honest** — list real negatives, not just positives.
- Decisions about future plans belong in [ROADMAP.md](ROADMAP.md), not here.
