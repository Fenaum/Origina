# Database Architecture

> Part of [Architecture Index](README.md)

---

## Migration Strategy

Raw SQL files in `db/migrations/` are the schema source of truth. `scripts/db_migrate.sh` tracks applied files in `schema_migrations` and runs each file in its own `BEGIN/COMMIT` transaction.

**Never use `Base.metadata.create_all()`** — it cannot manage PostgreSQL triggers, partial indexes, or TEXT+CHECK constraints safely.

---

## Migration Number Sequence

```
010  tenants
020  users / RBAC
030  enum types (defined but all columns now TEXT — see 122–125)
040  parties
041  user_parties
050  loans (header)
055  conditions
060  properties
070  exceptions (initial — loan_id was NOT NULL)
071  tasks
072  notes
073  loan_status_events
080  documents
090  decisions/decisioning
100  audit snapshots
101  borrowers + addresses
102–109  hardening (audit columns, check constraints, indexes, loan split, trigger fix)
110  borrower intake (sessions, answers, handoffs)
111  condition enhancements
112  documents v2
113  property details
114  appraisal
115  credit reports
116  escrow
117  title orders
118–121  exceptions v2 (nullable loan_id, structured fields, events/comments, decisions)
122  loans.status + loan_status_events → TEXT + CHECK (was ENUM)
123  conditions.status, tasks.status/priority → TEXT + CHECK (was ENUM)
124  controlled_value_sets + controlled_values tables (18 sets, 144 seed values)
125  loans.purpose, borrowers.type/income_type/relationship, parties.party_type,
     loan_parties.role → TEXT + CHECK (loan_parties required DROP+ALTER+re-add composite PK)
```

**Planned next:** 126–131 for Settings module (user profile, sessions, tenant settings, loan program defaults, notification policies, condition templates) — see [settings.md](settings.md).

**Current state:** Zero PostgreSQL ENUM columns remain. All domain values are TEXT + CHECK constraint.

---

## TEXT + CHECK Convention

Any column that may need new values over time must be `text NOT NULL` with a `CHECK (col IN (...))`, never `ENUM`. Rationale: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction, but the migration runner wraps every file in `BEGIN/COMMIT`.

In SQLAlchemy models: `Mapped[str]` + `String`. Never `ENUM()` for mutable status fields.

---

## Loan Split Pattern

```
loans              — header: status, purpose, program, assigned_to, dates
loan_financials    — amounts: loan_amount, LTV, FICO, DTI, DSCR  (loan_id PK+FK)
loan_terms         — rate: interest_rate, term_months, lock_days  (loan_id PK+FK)
```

All three rows inserted atomically when creating a loan. Satellite tables use `loan_id` as PK to enforce 1:1 at schema level.

---

## Controlled Values Architecture

```
controlled_value_sets  (set_code PK, scope, description)
controlled_values      (set_code, tenant_id nullable, code, label, sort_order, is_active, metadata JSONB)
                       UNIQUE NULLS NOT DISTINCT (set_code, tenant_id, code)
```

- `tenant_id IS NULL` = system/global default
- `tenant_id = X` = tenant override, shadows the system row at query time
- 18 value sets seeded: `loan_status`, `loan_purpose`, `loan_program`, `condition_status`, `exception_category`, `exception_type`, `reason_code`, `document_type`, `borrower_type`, `borrower_relationship`, `borrower_income_type`, `party_type`, `loan_party_role`, `task_status`, `task_priority`, `exception_status`, `exception_severity`, `compensating_factor`
- API: `GET /api/v1/metadata/values/{set_code}` merges system + tenant rows

Adding a new value: `INSERT INTO controlled_values` only — no migration, no deploy required.

---

## Audit Triggers

`log_audit_event()` fires AFTER INSERT/UPDATE/DELETE on: `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`, `exceptions`, `loan_status_events`.

- Reads actor from `app.current_user_id` (set by `get_audited_db` dependency)
- Writes JSON diff to `audit_log`
- Tables where PK is `loan_id` (not `id`) are listed in `_LOAN_ID_PK` inside the trigger function

---

## Event and Audit Architecture

### Dual-Write Status History

Every loan status transition writes atomically to:
1. `loans.status` — current state (queryable, indexable for pipeline)
2. `loan_status_events` (append-only) — `from_status`, `to_status`, `actor_user_id`, `reason`, `occurred_at`

### Audit Log

`audit_log` captures `before` and `after` JSON for every INSERT/UPDATE/DELETE on audited tables. Written by DB trigger — cannot be bypassed by application code.

### Exception Event Log

`exception_events` (append-only) tracks every action: creation, status transition, loan linking, decisions, condition changes. Each event stores `event_type` + `event_data` JSONB for flexible per-event payload.

---

## Pipeline Query Design

`GET /api/v1/loans/pipeline` uses a single SQL query with LATERAL JOINs for borrower name, property state, and conditions counts. Zero N+1 at any pipeline size.
