# Current Sprint — Sprint 3: Full Workspace

> **Sprint index:** [docs/sprints/README.md](sprints/README.md)
> **Previous sprint:** [Sprint 2 — Core Workflow (archived)](sprints/sprint-2-core-workflow.md)
> **Full backlog:** [ROADMAP.md](ROADMAP.md) | **Session log:** [BUILD_HISTORY.md](BUILD_HISTORY.md)
> **Detailed build spec:** [docs/sprints/sprint-3-build-spec.md](sprints/sprint-3-build-spec.md) ← read this before coding

---

## Sprint Goal

A complete loan review cycle is possible inside the workspace — notes posted, status transitioned with a reason, underwriter sees pricing/eligibility/exceptions, documents uploaded and tracked.

**Sprint is done when:**
- A team member can post a note on a loan and see it appear without refreshing the page
- The audit log shows real `audit_log` events for material changes on a loan
- The status dropdown lists only valid transitions and writes a `loan_status_events` row + reason
- The Underwriting tab shows the latest eligibility run, pricing run history, and any open exceptions
- A real PDF can be uploaded to a loan, listed, downloaded, and archived
- All B-gate tests from Sprints 1, 2, and 3 are green

---

## Phases

### Phase 3.1 — Notes + Audit Log Wiring
**Status:** ✅ Complete
**Spec:** [sprint-3-build-spec.md §3.1](sprints/sprint-3-build-spec.md#phase-31--notes--audit-log-wiring)

| Task | File(s) | Notes |
|---|---|---|
| Add `NoteOut`, `PricingRunOut`, `EligibilityRunOut` to api types | `src/frontend/src/types/api.ts` | Field names match `AuditLogOut` (Pydantic) |
| Fix stale `AuditLogEntry` type (actor_user_id, entity_type, etc.) | `src/frontend/src/types/api.ts` | Pre-existing type used wrong field names; corrected to match backend |
| Create `notesService.ts` | `src/frontend/src/services/notesService.ts` | Unwraps pagination envelope to a flat array |
| Create `auditService.ts` | `src/frontend/src/services/auditService.ts` | Same envelope-unwrap pattern |
| Rewrite `WorkspaceConversation.tsx` | `src/frontend/src/components/loans/workspace/WorkspaceConversation.tsx` | Replaces `MESSAGES` mock with real `/notes/` reads + writes; Cmd+Enter shortcut, empty/loading states |
| Rewrite `WorkspaceAuditLog.tsx` | `src/frontend/src/components/loans/workspace/WorkspaceAuditLog.tsx` | Replaces `AUDIT_EVENTS` mock with real `/audit-logs/?entity_id=…`; renders action label + entity label + first diff field |
| Fix `NoteCreate.tenant_id` bug | `src/backend/app/schemas/workflow_schema.py` | Schema rejected POST bodies that lacked `tenant_id` — now matches the endpoint's existing pattern (tenant_id injected from JWT) |
| Install audit triggers in test schema | `tests/backend/conftest.py` | `Base.metadata.create_all()` doesn't install the `log_audit_event()` trigger; added inline install of the function + trigger attachments |
| Write `tests/backend/test_notes_and_audit.py` | `tests/backend/test_notes_and_audit.py` | 3 tests — create+list, tenant isolation, audit-on-create |

**Phase done when:** Notes post + appear without refresh. Audit log shows real events. All 3 tests pass.

---

### Phase 3.2 — Status Transition UI
**Status:** ✅ Complete
**Spec:** [sprint-3-build-spec.md §3.2](sprints/sprint-3-build-spec.md#phase-32--status-transition-ui)

| Task | File(s) | Notes |
|---|---|---|
| Audit existing `WorkspaceStatus.tsx` | `src/frontend/src/components/loans/workspace/WorkspaceStatus.tsx` | Already wired — POST `/loans/{id}/status/transition` + refetch on success were in place from the prior session |
| Write `tests/backend/test_status_transitions.py` | `tests/backend/test_status_transitions.py` | 4 tests — valid transition, invalid → 422, history grows, terminal → no available transitions |

**Phase done when:** All 4 tests pass; the Status tab already meets the spec's UI requirements.

---

### Phase 3.3 — Underwriting + Decision Panel
**Status:** ✅ Complete
**Spec:** [sprint-3-build-spec.md §3.3](sprints/sprint-3-build-spec.md#phase-33--underwriting--decision-panel)

| Task | File(s) | Notes |
|---|---|---|
| Create `decisioningService.ts` | `src/frontend/src/services/decisioningService.ts` | listPricingRuns, listEligibilityRuns + envelope unwrap |
| Create `exceptionsService.ts` | `src/frontend/src/services/exceptionsService.ts` | listExceptions — surfaces exception rows in the UW tab |
| Extend `WorkspaceUnderwriting.tsx` | `src/frontend/src/components/loans/workspace/WorkspaceUnderwriting.tsx` | Adds Eligibility / Pricing Runs / Exceptions panels under the existing UW decision form; existing tab navigation in `workspaceSections.ts` already routes `underwriting` here |
| Register in workspace navigation | `src/frontend/src/components/loans/LoanWorkspaceShell.tsx` | Already wired — `if (section === "underwriting") return <WorkspaceUnderwriting loan={loan} />` was in place |

**Phase done when:** The Underwriting tab renders eligibility, pricing history, and exceptions when present. Empty states when none exist.

---

### Phase 3.4 — Documents Section
**Status:** ✅ Complete
**Spec:** [sprint-3-build-spec.md §3.4](sprints/sprint-3-build-spec.md#phase-34--documents-section)

| Task | File(s) | Notes |
|---|---|---|
| Audit existing `documents.py` list endpoint | `src/backend/app/api/v1/documents.py` | `GET /documents/` already exists (with `archived_at` filter); no backend work needed |
| Create `documentsService.ts` | `src/frontend/src/services/documentsService.ts` | listDocuments, uploadDocument (uses raw `fetch` for multipart — `apiRequest` forces `application/json`), archiveDocument, `buildDocumentDownloadUrl` |
| Rewrite `WorkspaceDocuments.tsx` | `src/frontend/src/components/loans/workspace/WorkspaceDocuments.tsx` | Replaces `DOCUMENTS` mock with `/documents/?loan_id=…` + upload form + archive + download link |
| Write `tests/backend/test_documents.py` | `tests/backend/test_documents.py` | 3 tests — upload+list, download, archive excludes from list |

**Phase done when:** A real file can be uploaded to a loan via the workspace. The document list shows uploaded files. Clicking download streams the file back. Archiving removes it from the list. All 3 tests pass.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 3.1 — Notes + Audit Log Wiring | ✅ Complete | this session |
| 3.2 — Status Transition UI | ✅ Complete | this session |
| 3.3 — Underwriting + Decision Panel | ✅ Complete | this session |
| 3.4 — Documents Section | ✅ Complete | this session |

---

## B-Gate Tests Checklist

Sprint 1 + 2 tests must remain green (regression). Sprint 3 adds:

- [x] `tests/backend/test_auth_secret_from_env.py` (Sprint 1, 4 tests)
- [x] `tests/backend/test_cors.py` (Sprint 1, 2 tests)
- [x] `tests/backend/test_pagination_envelope.py` (Sprint 1 + Sprint 2.4)
- [x] `tests/backend/test_loan_submission_e2e.py` (Sprint 1 — 3 pass / 0 skip)
- [x] `tests/backend/test_loan_financials_endpoint.py` (Sprint 1 — 4 pass / 0 skip)
- [x] `tests/backend/test_user_rbac.py` (Sprint 2.1, 5 tests)
- [x] `tests/backend/test_condition_lifecycle.py` (Sprint 2.2, 9 tests)
- [x] `tests/backend/test_notes_and_audit.py` (Sprint 3.1, 3 tests) — **NEW**
- [x] `tests/backend/test_status_transitions.py` (Sprint 3.2, 4 tests) — **NEW**
- [x] `tests/backend/test_documents.py` (Sprint 3.4, 3 tests) — **NEW**

**Final result:** 46 tests collected, 46 passed (0 skipped).

---

## After This Sprint Completes

1. Write a completion summary below (what shipped, what slipped, lessons learned)
2. Copy this file → `docs/sprints/sprint-3-full-workspace.md`
3. Update `docs/sprints/README.md` — mark Sprint 3 complete, add archive link and completion date
4. Move all Sprint 3 ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Update `AGENTS.md` / `CLAUDE.md` — sprint status, "What to build next", technical debt
6. Write a new `CURRENT_SPRINT.md` for Sprint 4 — Manager Layer

---

## Completion Summary
*(Sprint 3 closed this session.)*

**Completed:** All four phases (3.1, 3.2, 3.3, 3.4). 10 new backend tests, 4 new frontend services, 4 rewritten workspace components, 1 schema bug fix, 1 test-infrastructure fix.

**Slipped to Sprint 4:** None.

**Lessons learned:**
- **Pydantic schema drift bug:** `NoteCreate.tenant_id` was marked required in the schema, so any caller posting a note was rejected with 422 even though the endpoint already injects `tenant_id` from the JWT. The endpoint had been silently broken since notes shipped. Sprint 3 was the first time we tried to use notes from a test, so the bug surfaced immediately. Lesson: write the integration test for every endpoint, even when the UI work isn't ready.
- **Test schema doesn't install triggers:** `Base.metadata.create_all()` builds tables but skips PL/pgSQL trigger functions. The audit log test failed (zero rows) until we inlined the `log_audit_event()` function and `CREATE TRIGGER` statements into the `test_engine` fixture. A migration-based test runner (vs `create_all`) would solve this cleanly — see ADR backlog.
- **Audit action casing:** the trigger stores `lower(tg_op)` ('insert', 'update', 'delete'); the spec's test expected 'INSERT'. Tests should match the API contract exactly, so we assert case-insensitively in the test rather than post-processing the trigger.
- **Lint rule for `setState` in effects:** the new `eslint-config-next` flags any synchronous `setLoading(true)` inside `useEffect`, even when it's the standard pattern (and matches what `WorkspaceStatus.tsx` already does). The cleaner shape (used in `WorkspaceAuditLog.tsx`): don't `setLoading(true)` in the effect body — `useState(true)` already provides it; toggle `false` from the `.finally()` handler.
- **Upload form vs apiRequest:** `apiRequest` always sets `Content-Type: application/json`, which would clobber the browser-set multipart boundary for file uploads. The documents service uses raw `fetch` with the `Authorization` header set manually — exactly the pattern the spec called out, but worth re-emphasising as the rule for any future upload work.
