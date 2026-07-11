# Sprint 8 — Implementation Spec
## URLA (1003) Foundation: The Full Application Record

> **For:** any LLM/developer implementing this sprint · **Validated by:** Claude Code after completion
> **Milestone:** [M2 — Operational Depth](MILESTONES.md) (sprint 3 of 5)
> **Sprint goal:** Origina holds a complete loan application, not just a header. The URLA (Form 1003) data model lands in migrations, a section-by-section editor replaces the `/loans/new/manual` placeholder, and the borrower intake flow feeds the same record.
> **Prerequisite:** Sprint 6 Phase 6.2 (loan detail endpoint + panels — the editor builds on them).

---

## Scope stance (PM note)

Full URLA is enormous. This sprint ships the **Non-QM-relevant subset** as real schema, and the rest as explicitly-labeled deferred sections. A DSCR lender doesn't need military-service fields on day one; they do need employment/income, assets, liabilities, REO, and declarations. Do not attempt MISMO import/export this sprint — that's an integration (M4+); `mismoService.ts` stays mocked.

## Phase 8.1 — Data Model (migrations ~135+)

| Table | Purpose | Notes |
|---|---|---|
| `borrower_employment` | Employment/self-employment history per borrower | Multiple rows; `is_current`, `is_self_employed`, monthly income breakdown fields |
| `borrower_assets` | Asset accounts | type (TEXT+CHECK from controlled values), institution, value; `used_for_qualification` flag (asset-depletion programs) |
| `borrower_liabilities` | Debts | type, creditor, balance, monthly payment, `paid_off_at_closing` |
| `borrower_reo` | Real-estate-owned schedule | Critical for DSCR/investor borrowers — property, value, liens, rental income |
| `borrower_declarations` | 1003 Section 5 yes/no declarations | One row per borrower per loan |
| `loan_application_meta` | Section completion tracking | `section_status` JSONB (`not_started/in_progress/complete` per section) — drives the editor's progress rail |

All: `tenant_id`, audit trigger where user-editable, TEXT+CHECK for every enum-like column, controlled-value sets for types.

## Phase 8.2 — API + Services

- `api/v1/application.py` (new router): `GET/PUT /loans/{id}/application/{section}` — section-granular read/write (`borrowers`, `employment`, `assets`, `liabilities`, `reo`, `declarations`, `property`, `loan-terms`). PUT is upsert-by-section with `get_audited_db`; each PUT recomputes `section_status`.
- `services/application_repo.py`: section validators (Pydantic per-section schemas in `schemas/application_schema.py`); completeness check `GET /loans/{id}/application/completeness` returns per-section status + blocking gaps — **submission (`new_draft → submitted`) requires required sections complete** (wire into the status-transition validation in `status.py`).

## Phase 8.3 — Editor UI

- `/loans/new/manual` becomes: create draft (existing atomic 3-table insert) → redirect to `/loans/{id}?section=application`.
- New workspace section `WorkspaceApplication.tsx`: left progress rail (sections + status dots from `loan_application_meta`), right form panel per section. React Query per section; save-per-section (no giant single form). Reuse `SectionCard`/`SaveBar` patterns from settings.
- Borrower intake flow (`pages/borrower/`) writes into the same section API — one record, two doors.

## B-Gate Tests (Sprint 8)

- [ ] `tests/backend/test_application_sections.py` — PUT/GET round-trip per section; tenant isolation; audit rows written
- [ ] `tests/backend/test_application_completeness.py` — completeness math; submission blocked with named gaps until required sections complete
- [ ] `tests/backend/test_urla_migrations.py` — schema exists with CHECKs (runs against migration-built test schema from Sprint 6)
- [ ] Vitest: progress rail reflects section statuses; one section form saves and shows completion
- [ ] Green CI run URL: _(paste at close)_

## Out of scope

MISMO 3.4 import/export · document generation (PDF 1003) · credit-pull integration (reads stay manual-entry; migration 115 tables exist for later) · non-Non-QM sections (military service, HMDA demographics — deferred, labeled in UI).
