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

## Documentation Maintenance Rules

- **Add an ADR for every decision that would surprise a new developer.**
- **Update Status to `Deprecated` (never delete) when a decision is reversed** — add a "Superseded by" line pointing to the new ADR.
- **Date field:** use the date the decision was made or first implemented, not the date it was documented.
- **Keep the Consequences section honest** — list real negatives, not just positives.
- Decisions about future plans belong in [ROADMAP.md](ROADMAP.md), not here.
