# Sprint 7 — Implementation Spec
## Document Platform v1: Real Storage, Auto-Linking, Versioning

> **For:** any LLM/developer implementing this sprint · **Validated by:** Claude Code after completion
> **Milestone:** [M2 — Operational Depth](MILESTONES.md) (sprint 2 of 5)
> **Sprint goal:** Documents live in S3-compatible object storage behind a clean interface, uploads auto-link to the conditions they satisfy, and every document carries version history. This is also the #1 prerequisite for the future AI layer (per the AI Scope ADR).
> **Prerequisite:** Sprint 6 complete (migration-based test runner matters here — this sprint adds migrations).

---

## Architecture decision (write the ADR first)

**ADR: Object storage via S3 API, provider-agnostic.** Code targets the S3 *protocol*, not AWS: `boto3` against **MinIO** in local dev/CI (add to `docker-compose.yml`), AWS S3 (or R2/B2) in production — an env-var change, not a code change. Add to DECISIONS.md before implementing.

## Phase 7.1 — Storage Backend Interface

| Task | File(s) | Notes |
|---|---|---|
| `StorageBackend` protocol | `services/storage/base.py` | `put(key, stream, content_type) -> StoredObject`, `get(key) -> stream`, `delete(key)`, `presigned_url(key, ttl)`. Small surface — no S3 types leak out. |
| `S3StorageBackend` | `services/storage/s3.py` | boto3; bucket + endpoint + creds from `core/config.py` (`S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`). Key scheme: `{tenant_id}/loans/{loan_id}/documents/{document_id}/{version}` — tenant prefix is the isolation boundary. |
| `LocalStorageBackend` | `services/storage/local.py` | Wraps the current Sprint-3 local-file behavior; selected when `STORAGE_BACKEND=local`. Keeps dev usable without Docker changes and gives a migration path. |
| MinIO in dev + CI | `docker-compose.yml`, `.github/workflows/ci.yml` | `minio/minio` service; CI job gets it as a service container alongside Postgres. |
| Migrate documents API | `api/v1/documents.py`, `services/document_repo.py` | Upload/download/archive go through `StorageBackend`. DB rows gain `storage_key`, `content_type`, `size_bytes`, `checksum_sha256` (migration). Download returns a presigned URL (S3) or streams (local). |

## Phase 7.2 — Document ↔ Condition Auto-Linking

| Task | File(s) | Notes |
|---|---|---|
| Category → condition-type mapping | new migration: `document_category_condition_map` (tenant-overridable, same system/tenant-shadow pattern as controlled values) | e.g. category `bank_statement` satisfies condition types `income_bank_stmt_*`. Seed the obvious Non-QM mappings. |
| Auto-link on upload | `services/document_repo.py` | On upload with a category: find the loan's **outstanding** conditions whose type maps to that category → create `document_conditions` links → emit `document.linked` domain event (outbox). Never auto-*clear* a condition — linking is a suggestion; clearing stays a human action (mirrors the AI-stays-advisory rule). |
| Surface in UI | `WorkspaceConditions.tsx`, `WorkspaceDocuments.tsx` | Condition rows show linked-document chips; upload flow shows "this will attach to N outstanding conditions" preview. |

## Phase 7.3 — Versioning + Borrower-Facing View

| Task | File(s) | Notes |
|---|---|---|
| Version chain | migration: `documents.version`, `supersedes_document_id` | Re-upload of same category+name creates v2 pointing at v1; listings show latest, expandable history. Storage keys already carry `{version}`. |
| Borrower-facing condition view endpoint | `api/v1/conditions.py` | `GET /loans/{id}/conditions/borrower-view` — outstanding conditions with borrower-friendly labels, no internal notes. Backlog item from ROADMAP P3; cheap now, needed for any future borrower portal. |

## B-Gate Tests (Sprint 7)

- [ ] `tests/backend/test_storage_backend.py` — put/get/delete/presign round-trip against MinIO (CI) and local backend; tenant-prefixed keys
- [ ] `tests/backend/test_document_upload_s3.py` — upload → DB row (checksum/size) → download URL works; archive removes access, not the object
- [ ] `tests/backend/test_condition_autolink.py` — upload with mapped category links only outstanding conditions of the mapped types, same loan, same tenant; emits event; never changes condition status
- [ ] `tests/backend/test_document_versions.py` — re-upload chains versions; latest-only listing; history complete
- [ ] Vitest: condition rows render document chips; upload preview shows link count
- [ ] Green CI run URL: _(paste at close)_

## Out of scope

Virus scanning, OCR/classification (AI layer, M5), borrower upload portal, retention policies (Sprint 14).
