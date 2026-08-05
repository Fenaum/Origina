# Current Sprint — Sprint 7: Document Platform v1

> **Sprint index:** [docs/sprints/README.md](sprints/README.md) | **Program plan:** [docs/sprints/MILESTONES.md](sprints/MILESTONES.md)
> **Previous sprint:** [Sprint 6 — Closeout & UAT Response (archived)](sprints/sprint-6-closeout-uat-response.md)
> **Full backlog:** [ROADMAP.md](ROADMAP.md) | **Session log:** [BUILD_HISTORY.md](BUILD_HISTORY.md)
> **Detailed build spec:** [docs/sprints/sprint-7-build-spec.md](sprints/sprint-7-build-spec.md) ← read this before coding
>
> **Update this at the start of every session** — mark the active phase, note the session goal, update status.

---

## Sprint Goal

**Milestone 2 (Operational Depth), sprint 2 of 5.** Documents live in S3-compatible object storage behind a clean `StorageBackend` interface, uploads auto-link to the conditions they satisfy, every document carries version history, and borrowers get a clean view of what's outstanding. This is also the **#1 prerequisite for the future AI layer** (per the AI Scope ADR) — without real storage, the document classification and extraction ladder has nothing to operate on.

Full task detail in the [build spec](sprints/sprint-7-build-spec.md).

---

## Phases

### Phase 7.1 — Storage Backend Interface (real storage behind a clean protocol)
**Status:** 🔄 Not started
**Est. effort:** ~2 sessions
**Spec:** [sprint-7-build-spec.md §7.1](sprints/sprint-7-build-spec.md#phase-71--storage-backend-interface)
**ADR first:** write **Object storage via S3 API, provider-agnostic** in `docs/DECISIONS.md` before coding. boto3 against MinIO in dev/CI and prod AWS/R2/B2; the env-var change (`S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`) is the only delta between targets.

| Task | File(s) | Notes |
|---|---|---|
| `StorageBackend` protocol | `services/storage/base.py` | `put(key, stream, content_type) -> StoredObject`, `get(key) -> stream`, `delete(key)`, `presigned_url(key, ttl)`. Small surface — no S3 types leak out. |
| `S3StorageBackend` | `services/storage/s3.py` | boto3. Key scheme: `{tenant_id}/loans/{loan_id}/documents/{document_id}/{version}` — tenant prefix is the isolation boundary. |
| `LocalStorageBackend` | `services/storage/local.py` | Wraps the current Sprint-3 local-file behavior; selected when `STORAGE_BACKEND=local`. Keeps dev usable without Docker changes and gives a migration path. |
| MinIO in dev + CI | `docker-compose.yml`, `.github/workflows/ci.yml` | `minio/minio` service; CI job gets it as a service container alongside Postgres. |
| Migrate documents API | `api/v1/documents.py`, `services/document_repo.py` | Upload/download/archive go through `StorageBackend`. DB rows gain `storage_key`, `content_type`, `size_bytes`, `checksum_sha256` (new migration). Download returns a presigned URL (S3) or streams (local). |

**Phase done when:** `services/storage/` ships, the documents API goes through it end-to-end, the new migration installs on a fresh DB and on the existing schema (additive, non-breaking), `docker-compose up` brings MinIO up alongside Postgres, and the Phase 7.1 B-gate test (`tests/backend/test_storage_backend.py`) is green against both backends with tenant-prefix keys verified.

### Phase 7.2 — Document ↔ Condition Auto-Linking
**Status:** 🔄 Not started
**Est. effort:** ~1 session
**Spec:** [sprint-7-build-spec.md §7.2](sprints/sprint-7-build-spec.md#phase-72--document--condition-auto-linking)

| Task | File(s) | Notes |
|---|---|---|
| Category → condition-type mapping | new migration: `document_category_condition_map` (tenant-overridable, same system/tenant-shadow pattern as controlled values) | e.g. category `bank_statement` satisfies condition types `income_bank_stmt_*`. Seed the obvious Non-QM mappings. |
| Auto-link on upload | `services/document_repo.py` | On upload with a category: find the loan's **outstanding** conditions whose type maps to that category → create `document_conditions` links → emit `document.linked` domain event (outbox). Never auto-*clear* a condition — linking is a suggestion; clearing stays a human action (mirrors the AI-stays-advisory rule). |
| Surface in UI | `WorkspaceConditions.tsx`, `WorkspaceDocuments.tsx` | Condition rows show linked-document chips; upload flow shows "this will attach to N outstanding conditions" preview. |

**Phase done when:** seeded mapping table is in place, upload of a categorized document auto-creates links to only the **outstanding** mapped-type conditions on the same loan+tenant, condition status is unchanged, a `document.linked` event lands in `domain_events`, and the Phase 7.2 B-gate (`tests/backend/test_condition_autolink.py`) covers the cases (mapped link, unmapped no-link, already-cleared no-link, cross-tenant no-link, event emission).

### Phase 7.3 — Versioning + Borrower-Facing Condition View
**Status:** 🔄 Not started
**Est. effort:** ~1 session
**Spec:** [sprint-7-build-spec.md §7.3](sprints/sprint-7-build-spec.md#phase-73--versioning--borrower-facing-view)

| Task | File(s) | Notes |
|---|---|---|
| Version chain | new migration: `documents.version`, `supersedes_document_id` | Re-upload of same category+name creates v2 pointing at v1; listings show latest, expandable history. Storage keys already carry `{version}`. |
| Borrower-facing condition view endpoint | `api/v1/conditions.py` | `GET /loans/{id}/conditions/borrower-view` — outstanding conditions with borrower-friendly labels, no internal notes. Backlog item from ROADMAP P3; cheap now, needed for any future borrower portal. |

**Phase done when:** `documents.version` + `supersedes_document_id` are in the schema, re-upload of an existing (category, name) tuple chains a new version, listings default to latest-only with a way to view history, the new endpoint returns only outstanding conditions with borrower-friendly labels, and the Phase 7.3 B-gate tests (`tests/backend/test_document_versions.py` + a `test_conditions_borrower_view.py` smoke) are green.

---

## Process rules (carried from Sprint 6)

1. **CI is the source of truth for test results.** B-gate checklist records test *file names and what they prove* — not hand-copied counts. Completion summary links the green CI run URL.
2. **No silent slippage.** A phase may close with unfinished tasks only if the completion note lists them under "slipped" with a destination (next sprint / tech-debt table).
3. **Commit and push at phase boundaries** — at least one pushed commit per phase, not one giant local commit on sprint close (Sprint 6's lesson learned).
4. **Migration-based test runner remains outstanding.** Either Sprint 7 fixes it as the first thing in Phase 7.1 (the new migrations will hit the same problem Sprint 6 found), or it slips again with an explicit destination. Flag at session start.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 7.1 — Storage Backend Interface | 🔄 Not started | — |
| 7.2 — Document ↔ Condition Auto-Linking | 🔄 Not started | — |
| 7.3 — Versioning + Borrower-Facing View | 🔄 Not started | — |

---

## B-Gate Tests Checklist

Sprint 1–6 B-gates remain green (regression) — see the [Sprint 6 archive](sprints/sprint-6-closeout-uat-response.md) for the canonical list. Sprint 7 adds:

- [ ] `tests/backend/test_storage_backend.py` — put/get/delete/presign round-trip against MinIO (CI) and local backend; tenant-prefixed keys
- [ ] `tests/backend/test_document_upload_s3.py` — upload → DB row (checksum/size) → download URL works; archive removes access, not the object
- [ ] `tests/backend/test_condition_autolink.py` — upload with mapped category links only outstanding conditions of the mapped types, same loan, same tenant; emits event; never changes condition status
- [ ] `tests/backend/test_document_versions.py` — re-upload chains versions; latest-only listing; history complete
- [ ] `tests/backend/test_conditions_borrower_view.py` (smoke) — borrower view returns only outstanding conditions with borrower-friendly labels; cross-tenant 404
- [ ] Vitest: condition rows render document chips; upload preview shows link count
- [ ] Green CI run URL: _(paste at phase close)_

---

## Open Risks (read at session start)

1. **Migration-based test runner still unresolved.** Sprint 6's *What slipped* named this as the first schema-debt-focused sprint's work. Sprint 7 *adds new migrations* (`documents.version`, `document_category_condition_map`, plus the storage columns) — the same multi-statement + ENUM replay problem will surface. **First decision of Phase 7.1:** ship the runner alongside Phase 7.1's migration, or accept another slip with a documented destination. Recommend shipping it: extracting `db/migrations/999_audit_trigger_install.sql` and reading it in conftest eliminates ~80 lines of duplicated PL/pgSQL and unblocks CI parity once and for all.
2. **Storage provider choice is an ADR, not a code decision.** Lock the S3-protocol-via-boto3 ADR before the boto3 install lands. If the discussion surfaces R2 vs. S3 vs. MinIO-perpetual-for-prod, that's a Phase 14 (production hosting) question, not a Sprint 7 question.
3. **Auto-clear is forbidden.** Auto-*link* is the contract. Auto-*clear* a condition based on a document upload is a state-machine bypass and a fair-lending surface; do not implement it (mirrors the AI-stays-advisory rule). Linters / code review gate: any PR that mutates `condition.status` in the auto-link path is a regression.
4. **Pushing Sprint 6's commit is still pending.** The Sprint 6 work (commit `ba8f948`) never got off the local branch — no SSH key, no MCP push access in that env. **Sprint 7's first session should resolve this** (push via `gh` if installed, or ask the user to push manually) so new work goes on top of a green CI baseline, not a local-only commit.
5. **UAT-1 findings (Phase 6.1) are still live.** Any P0/P1 that lands `BUG-…` before Phase 7.2 ships blocks Phase 7.2 the same way it blocked the Sprint 6 archive. Treat UAT-1 burn-down as Phase 0 — check `docs/BUILD_HISTORY.md` Bug Log at session start.

---

## Architecture Doc Updates Expected This Sprint

- `docs/DECISIONS.md` — new ADR: *Object storage via S3 API, provider-agnostic*
- `docs/architecture/integrations.md` — document the `StorageBackend` protocol + provider matrix
- `docs/architecture/database.md` — new migrations: `documents.storage_key`/`content_type`/`size_bytes`/`checksum_sha256`, `documents.version`/`supersedes_document_id`, `document_category_condition_map`
- `docs/architecture/backend.md` — `services/storage/` as a new top-level service category; document upload/download flow diagram update

---

## After This Sprint Completes

(To be done at the very end of the sprint, after the docs commit lands.)


1. Write a completion summary at the bottom of this file (what shipped, **what slipped**, lessons learned)
2. Copy this file → `docs/sprints/sprint-7-<name>.md`
3. Update `docs/sprints/README.md` — mark Sprint 7 complete, add archive link + completion date
4. Move completed ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Update `CLAUDE.md` — sprint status, technical debt table (clear the storage-related rows this sprint closes)
6. Update `docs/DECISIONS.md` cross-references if any ADR was added or superseded
7. Write a fresh `CURRENT_SPRINT.md` for Sprint 8 (URLA 1003 Foundation)
