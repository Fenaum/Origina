# URLA / 1003 Application Record — Architecture Plan

> **Status:** blueprint (2026-07-19). Resolves the open design questions in
> [sprint-8-build-spec.md](sprints/sprint-8-build-spec.md) before implementation. Related:
> [CONFIG_AND_DECISION_PLATFORM.md](CONFIG_AND_DECISION_PLATFORM.md) (field registry),
> [PRICING_DECISION_FUNDING_PLAN.md](PRICING_DECISION_FUNDING_PLAN.md) (gates, staleness).

The Sprint 8 spec lists the tables. This doc makes the five decisions the spec defers, because
they're expensive to reverse once a pilot has live applications.

---

## D1 — Normalized child tables, JSONB only for meta. (Confirming the spec, with the rule.)

`borrower_employment`, `borrower_assets`, `borrower_liabilities`, `borrower_reo` are real tables
(multiple rows per borrower, queried and summed individually — DSCR needs REO rental income as
a column, not a JSON path). `borrower_declarations` is one row of typed booleans per borrower.
JSONB is allowed **only** where the shape is a UI concern, not a domain fact:
`loan_application_meta.section_status`. The line: *if a rule, gate, or calculation will ever read
it, it's a column.* This keeps every application field registrable in the field registry
(`employment.monthly_income`, `reo.net_rental_income`) — JSONB blobs would orphan the registry.

## D2 — Borrowers are loan-scoped rows, not shared person entities.

The existing `borrowers` table stays per-loan: an application is a *snapshot of what the borrower
declared for this loan*, and sharing person rows across loans would let loan B's edit silently
mutate loan A's application (an audit and compliance hazard). Person-level identity (one human,
many loans) is a real future need — brokers resubmit the same investor repeatedly — so add a
nullable `borrowers.person_key uuid` now, unused, as the future join point to a `persons`
directory (M3+). Dedup becomes a matching problem later; it never becomes a migration of
application data.

Pairing: `borrowers.sort_order int` + `borrowers.borrower_role` TEXT CHECK
(`primary / co_borrower`), max enforced in service (Non-QM: up to 4). No separate "pair" entity —
joint-credit grouping, if ever needed, is a nullable `credit_group smallint`, deferred.

## D3 — Section API semantics: upsert with optimistic concurrency.

`PUT /loans/{id}/application/{section}` per the spec, plus:

- **Concurrency:** `loan_application_meta.revision int` returned on every GET; PUT requires
  `revision` in the body and 409s on mismatch. Two processors editing the same file is the
  normal case, not an edge case. Per-section revision is overkill; one counter per application.
- **Child-collection writes are replace-by-section** (client sends full list of employment rows;
  service diffs against existing by row id). Simpler than row-level PATCH endpoints and matches
  the save-per-section editor. Row ids stable across saves so documents/conditions can reference
  them.
- Each PUT recomputes `section_status` and emits `application.section_saved` (outbox) — cheap
  now, and the future AI-triage layer subscribes to exactly this.

## D4 — Completeness is data, not code.

The `submitted` gate ("required sections complete") must vary by program: DSCR doesn't require
employment; Bank Statement doesn't require REO. Encode required-field sets as **seeded config
keyed by program**, referencing field-registry-style paths:

```
application_requirements (tenant-overridable, controlled-value idiom)
  program TEXT · section TEXT · field_path TEXT · required bool · min_rows int NULL
```

v1 evaluates this with ~50 lines of service code (`application_repo.completeness()`), returning
`{section, missing: [field_path, …]}` per program. This is deliberately the first *consumer* of
the field-registry idea from CONFIG_AND_DECISION_PLATFORM.md — when the registry lands, these
`field_path`s become FK-validated instead of convention. Do **not** hardcode per-program Python
functions; that's the fork this decision exists to prevent.

The `application_complete` gate registers on `new_draft → submitted` in `transition_gates.py`
(not inline in `status.py` — supersedes the Sprint 8 spec's wording, same delta as Sprint 9's).

## D5 — No row versioning; lock by lifecycle, detect drift by hash.

Applications are **not** versioned tables (no `valid_from/valid_to` bitemporal machinery — huge
cost, no consumer). History and blame come from the audit trigger (attach to all new tables);
point-in-time reproducibility comes from the decision's `terms_snapshot` (which grows an
`application_snapshot` of qualification-relevant sections at decision time).

Edit policy after submission: sections stay **editable through `conditions_review`** (processors
fix files; that's the job), then an issued decision makes the application *hash-relevant* — the
same `input_hash` staleness mechanism as the pricing sheet: material post-decision edits flip
the decision/pricing stale flags and surface in the readiness checklist, rather than hard-locking
fields. Hard lock only at `funded`.

## Intake merge & sequencing

- Intake conversion writes through the same section PUTs (one record, two doors — per spec).
  The intake ranking engine's answers map to section payloads in `intake_repo`, no parallel
  schema.
- Migrations: 135 `borrower_employment` + `borrower_assets` + `borrower_liabilities`,
  136 `borrower_reo` + `borrower_declarations`, 137 `loan_application_meta` +
  `application_requirements` (+ seed). All tables: `tenant_id`, TEXT+CHECK, audit triggers,
  types from controlled values.
- Added B-gate test beyond the spec: `test_application_concurrency.py` — stale-revision PUT
  409s; replace-by-section preserves row ids.

**Out of scope (unchanged from spec):** MISMO import/export, PDF 1003 generation, HMDA/military
sections, credit-pull integration.
