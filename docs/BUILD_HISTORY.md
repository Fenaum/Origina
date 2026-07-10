# Origina LOS — Build History

A session-by-session record of what was built, reviewed, and decided. Use this to trace why things are the way they are.

> **Archives:**
> - Sessions 1–18 (Phase 1) — [docs/archive/BUILD_HISTORY_PHASE1.md](archive/BUILD_HISTORY_PHASE1.md)
> - Sessions 19–30 (Phase 2 / Sprint 1+2) — [docs/archive/BUILD_HISTORY_PHASE2.md](archive/BUILD_HISTORY_PHASE2.md)

The current file starts at **Session 31 (Sprint 3 — Full Workspace)**.

---

## Bug Log

| ID | Date | Severity | Title | Fix |
|----|------|----------|-------|-----|
| BUG-2026-07-09-001 | 2026-07-09 | High | ProtectedRoute redirect loop — `it_admin` users stuck on "Redirecting…" after role-vocabulary reconciliation | `ADMIN_ROLES = ["it_admin", "admin"]` so admins pass every page guard, plus a `target !== router.pathname` guard that bails out instead of redirecting into a denied page |
| BUG-2026-07-09-002 | 2026-07-09 | Low | Activity-rail placeholder renders as garbled Unicode (⌘↵ → 萧←) because the UI font lacks the keyboard-symbol codepoints | Placeholder changed to ASCII: "Post a note... (Cmd+Enter to send)" |
| BUG-2026-07-09-003 | 2026-07-09 | High | Pre-File Exceptions page crashes with `exceptions is not iterable` because the frontend reads the backend's pagination envelope as a bare array | Parse `res.json()` as `PaginatedResponse<ExceptionOut>` and assign `.items ?? []` — same envelope-unwrap pattern used by `WorkspaceExceptions.tsx`, `conditionsService`, `auditService`, and `decisioningService` |

### BUG-2026-07-09-001 — `ProtectedRoute` redirect loop

**Reported by:** user (manual QA after Sprint 2 sign-off)

**Symptom:** Logging in as `admin@origina.dev` (`it_admin` role) and hitting `/dashboard` resulted in `/dashboard/account-executive` rendering "Redirecting…" indefinitely.

**Root cause:** `src/frontend/src/components/app/ProtectedRoute.tsx` declared `const isAdmin = user?.role === "admin";`. Once Sprint 2 reconciled the role vocabulary and the canonical backend name became `"it_admin"` (legacy alias `"admin"` preserved), an `it_admin` user landing on a page with `allowedRoles={["account_executive"]}` was denied (role mismatch) AND was redirected to `roleDashboardPaths["it_admin"] = "/dashboard/account-executive"` — the same denied page. `router.replace` would then immediately fire again because the target matched the current path semantics — infinite loop.

**Fix:**
1. `const ADMIN_ROLES: UserRole[] = ["it_admin", "admin"]` — both names treated as superusers in the page guard.
2. Bail out when `target === router.pathname` — defensive guard eliminates the loop class even if a future role mismatch happens.

**Regression coverage:** Manual verification after fix — `admin@origina.dev` → `/dashboard` → renders `/dashboard/account-executive` correctly.
### BUG-2026-07-09-002 — Garbled placeholder in Activity rail composer

**Reported by:** user (manual QA after Sprint 2 sign-off)

**Symptom:** In the bottom-left Activity rail composer on the loan workspace, the textarea placeholder rendered as `Post a note... (萧← to send)`.

**Root cause:** Placeholder used `⌘` (U+2318, "Place of Interest") and `↵` (U+21B5, "Downwards Arrow With Tip Leftwards") + `…` (U+2026). The page font does not have glyphs for these codepoints, so the browser fell back to a CJK fallback font that picked visually similar but unrelated codepoints — the user saw CJK-looking `萧` and a generic arrow instead of the keyboard symbols they intended.

**Fix:** Replaced the symbols with ASCII: `placeholder="Post a note... (Cmd+Enter to send)"`. ASCII is universally supported in any font, so no fallback substitution can garble it.

**Regression coverage:** Manual verification — the placeholder now renders cleanly in the bottom-left composer across browsers.

### BUG-2026-07-09-003 — `exceptions is not iterable` on Pre-File Exceptions page

**Reported by:** user (Next.js 16.0.7 runtime, manually triggered by opening `/exceptions` after the page was wired against the live backend)

**Symptom:** `PreFileExceptionsPage` crashed at `src/pages/exceptions/index.tsx:600` with `TypeError: exceptions is not iterable` inside the `for (const e of exceptions)` count loop. The page rendered the header but failed before any cards or filter tabs appeared.

**Root cause:** `GET /api/v1/exceptions/` returns the standard pagination envelope `{items: [...], total: n}` (per Sprint 2 §2.4, enforced by `tests/backend/test_pagination_envelope.py`). The page called `setExceptions(await res.json() as ExceptionOut[])`, which assigned the **envelope object** into state. The follow-up `for...of` then tried to iterate a plain object and threw. The same shape-bug class was already fixed elsewhere — `WorkspaceExceptions.tsx`, `conditionsService`, `auditService`, and `decisioningService` all unwrap `.items` — but `pages/exceptions/index.tsx` predated that convention and was missed during the Sprint 3 envelope sweep.

**Fix:**
1. Added `PaginatedResponse` to the `@/types/api` import.
2. Replaced the bare-array cast with `const envelope = (await res.json()) as PaginatedResponse<ExceptionOut>; setExceptions(envelope.items ?? []);` — identical to the unwrap pattern already used in `WorkspaceExceptions.tsx`.

**Regression coverage:** `npx eslint src/pages/exceptions/index.tsx` → 0 errors. Manual reload of `/exceptions` against the live backend renders cards, filter tabs, and the approved-count banner without runtime errors.

---

## Session 31 — Sprint 2 Closure: Bug Log, Archives, BUILD_HISTORY Reset

**Type:** Documentation hygiene — log the ProtectedRoute bug, archive Sprint 1/2 history into `BUILD_HISTORY_PHASE2.md`, start a fresh `BUILD_HISTORY.md` for Sprint 3 onward.

### What was done

1. **Bug logged** in the new `## Bug Log` table at the top of `BUILD_HISTORY.md` (BUG-2026-07-09-001).
2. **Archived** `docs/BUILD_HISTORY.md` (sessions 19–30, Phase 2 era) into `docs/archive/BUILD_HISTORY_PHASE2.md`. Updated the inline archive reference in the moved file.
3. **Reset** `docs/BUILD_HISTORY.md` to start at Session 31 with the bug log + this closure entry. The file will accumulate Sprint 3+ sessions from here.

### Files touched

- `docs/BUILD_HISTORY.md` — replaced with the reset version.
- `docs/archive/BUILD_HISTORY_PHASE2.md` — new archive, contains everything that used to be in `BUILD_HISTORY.md`.

### Validation

- `ls docs/archive/` shows both `BUILD_HISTORY_PHASE1.md` and `BUILD_HISTORY_PHASE2.md`.
- Both files open without `<!-- broken link -->` markers; cross-references updated.

## Session 32 — Sprint 3: Full Workspace — notes, audit log, status UI, underwriting, documents

**Type:** Frontend wiring + targeted backend fixes + new tests. Sprint 3 from the build spec delivered end-to-end.

### What was done

**Phase 3.1 — Notes + Audit Log Wiring**
- `src/frontend/src/services/notesService.ts` — new. `listNotes`, `createNote` (envelope-unwrap pattern, matching `conditionsService`).
- `src/frontend/src/services/auditService.ts` — new. `listAuditLogs(entityId, token)`.
- `src/frontend/src/components/loans/workspace/WorkspaceConversation.tsx` — rewrote to fetch + post real notes via `notesService`. Cmd+Enter shortcut, loading skeleton, empty state. Replaced the hardcoded `MESSAGES` mock.
- `src/frontend/src/components/loans/workspace/WorkspaceAuditLog.tsx` — rewrote to read `audit_log` via `auditService`. Renders action (Created/Updated/Deleted), entity label, first diff field. Replaced the hardcoded `AUDIT_EVENTS` mock.
- `src/frontend/src/types/api.ts` — added `NoteOut`, `PricingRunOut`, `EligibilityRunOut`. Fixed stale `AuditLogEntry` field names to match `AuditLogOut` (was using `table_name`/`record_id`/`changes` — backend actually returns `entity_type`/`entity_id`/`diff`).
- `src/backend/app/schemas/workflow_schema.py` — removed required `tenant_id` from `NoteCreate`. The endpoint already injects tenant_id from the JWT; the schema was rejecting valid POST bodies.
- `tests/backend/conftest.py` — added inline install of `log_audit_event()` trigger function and audit triggers for `loans`, `borrowers`, `conditions`, `documents`, `loan_financials`, `loan_terms`, `notes`. `Base.metadata.create_all()` doesn't install PL/pgSQL triggers — without this the `audit_log` table stays empty.
- `tests/backend/test_notes_and_audit.py` — new, 3 tests (create+list, tenant isolation, audit-on-create).

**Phase 3.2 — Status Transition UI**
- Audited `WorkspaceStatus.tsx` — already wired (transition handler in place). No code changes.
- `tests/backend/test_status_transitions.py` — new, 4 tests (valid transition, invalid → 422, history grows, terminal → empty `available_transitions`).

**Phase 3.3 — Underwriting + Decision Panel**
- `src/frontend/src/services/decisioningService.ts` — new. `listPricingRuns`, `listEligibilityRuns`, create variants.
- `src/frontend/src/services/exceptionsService.ts` — new. `listExceptions(loanId, token)`.
- `src/frontend/src/components/loans/workspace/WorkspaceUnderwriting.tsx` — extended with Eligibility / Pricing Runs / Exceptions panels under the existing UW decision form. `WorkspaceContent` in `LoanWorkspaceShell.tsx` already routed `section === "underwriting"` here — no nav change needed.

**Phase 3.4 — Documents Section**
- Audited `src/backend/app/api/v1/documents.py` — `GET /documents/?loan_id=...` already exists with `archived_at` filter. No backend work needed.
- `src/frontend/src/services/documentsService.ts` — new. `listDocuments`, `uploadDocument` (raw `fetch` because `apiRequest` forces `Content-Type: application/json` which breaks multipart), `archiveDocument`, `buildDocumentDownloadUrl`.
- `src/frontend/src/components/loans/workspace/WorkspaceDocuments.tsx` — rewrote to upload/list/archive/download real documents. Upload form in left rail (type picker + file input), archive button in metadata panel, direct download link to `/documents/{id}/download`.

**Tests**
- `tests/backend/test_documents.py` — new, 3 tests (upload+list, download, archive excludes from list).

### Validation

- `pytest tests/backend/ -v` → **46 passed, 0 failed** (3 new + 3 + 4 + existing 36).
- `tsc --noEmit` (frontend) → clean.
- `npm run lint` (frontend) → 22 problems total (9 errors + 13 warnings), same as baseline; none of the new files introduced lint errors.

### Files touched

- `src/frontend/src/services/notesService.ts` (new)
- `src/frontend/src/services/auditService.ts` (new)
- `src/frontend/src/services/decisioningService.ts` (new)
- `src/frontend/src/services/documentsService.ts` (new)
- `src/frontend/src/services/exceptionsService.ts` (new)
- `src/frontend/src/components/loans/workspace/WorkspaceConversation.tsx`
- `src/frontend/src/components/loans/workspace/WorkspaceAuditLog.tsx`
- `src/frontend/src/components/loans/workspace/WorkspaceUnderwriting.tsx`
- `src/frontend/src/components/loans/workspace/WorkspaceDocuments.tsx`
- `src/frontend/src/types/api.ts` (NoteOut, PricingRunOut, EligibilityRunOut, AuditLogEntry fields)
- `src/backend/app/schemas/workflow_schema.py` (NoteCreate.tenant_id removal)
- `tests/backend/conftest.py` (trigger install)
- `tests/backend/test_notes_and_audit.py` (new)
- `tests/backend/test_status_transitions.py` (new)
- `tests/backend/test_documents.py` (new)
- `docs/CURRENT_SPRINT.md` (Sprint 3 active sprint doc)
- `docs/sprints/sprint-3-full-workspace.md` (new — Sprint 3 archive)
- `docs/sprints/sprint-2-core-workflow.md` (archive copy)
- `docs/sprints/README.md` (Sprint 2 + 3 marked complete)
- `AGENTS.MD` / `CLAUDE.md` (Sprint status + technical debt updated)
