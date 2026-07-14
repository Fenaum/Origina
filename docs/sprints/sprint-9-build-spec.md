# Sprint 9 — Implementation Spec
## Processing & Funding: The Operational Checklist

> **For:** any LLM/developer implementing this sprint · **Validated by:** Claude Code after completion
> **Milestone:** [M2 — Operational Depth](MILESTONES.md) (sprint 4 of 5)
> **Sprint goal:** A processor can run a file through a milestone checklist, the escrow/title/appraisal tables (migrations 114–117) get their UI, and a funding worksheet takes a loan from `approved` to `funded` with numbers that balance.
> **Prerequisite:** Sprint 8 (application record feeds the funding worksheet).

---

## Phase 9.1 — Processing Milestones

- Migration: `processing_milestones` (tenant-overridable template set — same system/tenant-shadow pattern) + `loan_milestones` (instance per loan: status `pending/in_progress/complete/waived`, completed_by, completed_at, sort_order). Seed a standard Non-QM wholesale template (file intake → disclosures ack → appraisal ordered → appraisal received → title ordered → title received → insurance verified → UW submission ready).
- `api/v1/milestones.py`: list/complete/waive per loan; template CRUD under admin. Completing a milestone emits `milestone.completed` (outbox) — the Sprint 12 SLA engine will consume these.
- `WorkspaceProcessing.tsx` (replaces placeholder): checklist UI with complete/waive actions, who/when stamps, progress %; pipeline grid gains a milestone-progress column.

## Phase 9.2 — Third-Party Panels (wire existing schema)

Migrations 114–117 (appraisal, credit reports, escrow, title orders) have tables but no UI. This phase is **manual-entry panels**, not integrations:

- `api/v1/` routers + `_repo.py` services for appraisal orders and title/escrow (credit stays read-only display of any seeded rows).
- Workspace sections: appraisal panel (order date, vendor, value, received doc link) and title/escrow panel (order, commitment, fees) — both linkable to documents from Sprint 7.

## Phase 9.3 — Funding Worksheet

- Migration: `loan_funding` (1:1 `loan_id` PK, satellite-table pattern): wire amounts, fee lines (JSONB or child table `funding_fee_lines`), per-diem interest, disbursement date, net-funding math.
- `services/funding_repo.py`: worksheet compute + **balance check** — `funded` transition (already gated by the status state machine) additionally requires a balanced, approved worksheet. Wire into `status.py` transition validation, same pattern as Sprint 8 completeness gate.
- `WorkspaceFunding.tsx`: worksheet editor, computed totals, imbalance warnings, "mark funded" action (role-gated: account_manager/it_admin).
- Pipeline priority field: `loans.priority` (TEXT+CHECK: low/normal/high/rush) + API field + pipeline column/filter — small standalone backlog item, fits here with the pipeline already open.

## B-Gate Tests (Sprint 9)

- [ ] `tests/backend/test_milestones.py` — template instantiation on loan create; complete/waive; event emitted; tenant isolation
- [ ] `tests/backend/test_funding_worksheet.py` — compute math; unbalanced worksheet blocks `funded`; balanced allows it; audit trail
- [ ] `tests/backend/test_third_party_panels.py` — appraisal/title CRUD + document linking
- [ ] Vitest: WorkspaceProcessing checklist renders + completes; WorkspaceFunding shows imbalance warning
- [ ] Green CI run URL: _(paste at close)_

## Out of scope

Real vendor integrations (appraisal/title/credit APIs — M4 Integration Platform) · disclosures/compliance docs generation · wire instructions/banking.
