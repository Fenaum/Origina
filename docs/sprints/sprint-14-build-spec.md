# Sprint 14 — Build Spec (DRAFT — refine at M2 gate)
## Audit, Retention & SOC 2 Groundwork

> **Status:** rolling-wave draft. Promote during Sprint 13.
> **Milestone:** [M3 — Enterprise-Ready](MILESTONES.md) (sprint 4 of 5)
> **Sprint goal:** The compliance story becomes demonstrable: auditors can get exports, the audit log has a scale plan, and the SOC 2 control checklist maps to implemented mechanisms rather than intentions.

## Planned phases

- **14.1 Audit export & query:** filtered export (date range / loan / actor / table) to CSV + JSONL, generated async (Sprint 12 job runner) and delivered to S3 with presigned download; admin UI under Settings → Admin → Audit Log. Tamper-evidence: per-batch checksum recorded in an `audit_exports` table.
- **14.2 Partitioning + retention:** write the long-pending `audit_log` partitioning ADR (monthly by `occurred_at`) and implement — **this is the deadline: do it before a pilot's log gets big, not after.** Tenant-configurable retention policy for documents and logs (policy recorded now, enforcement job simple: archive-to-cold-prefix, never silent delete).
- **14.3 SOC 2 Type 1 groundwork:** control matrix doc (`docs/compliance/SOC2_CONTROLS.md`) mapping common criteria to mechanisms (access control → Sprint 11 roles + Sprint 13 sessions; change management → CI gates + branch protection; monitoring → Sprint 12 events); access-review report endpoint (who has what role/team, last login) exportable for quarterly reviews; gap list with owners for what's process-not-code.

## Key decisions (ADRs)

`audit_log` partitioning (write it, finally) · retention semantics per record class (mortgage docs have statutory minimums — get real numbers from the pilot lender's compliance contact during UAT) · whether audit export needs legal-hold support now or at M4.

## B-gates (draft)

Export round-trip with checksum verification · partitioned table serves existing audit queries unchanged (regression suite green) · access-review report accuracy against seeded org · retention job archives and never deletes.
