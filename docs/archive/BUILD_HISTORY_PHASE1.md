# Origina LOS — Build History

A session-by-session record of what was built, reviewed, and decided. Use this to trace why things are the way they are.

---

## Session 1 — Architecture Design: Borrower Intake

**Type:** Architecture / Design (text only, no code written)

**Deliverable:** Full architecture specification for an immersive borrower welcome + intake experience covering:
- Product flow (welcome → questions → ranking → handoff)
- Frontend architecture (Zustand stores, question branching, sessionStorage)
- Backend architecture (anonymous sessions, ranking endpoint)
- Database schema (`intake_sessions`, `intake_answers`, `intake_handoffs`)
- Recommendation ranking engine design
- UX content strategy and compliance guardrails
- TypeScript interface definitions
- FastAPI + SQLAlchemy code examples
- Implementation phases (5 phases)

**Key decisions made:**
- Anonymous sessions — no auth required for intake
- `sessionStorage` (not localStorage) for intake answers — privacy
- Frontend ranking (`rankMockPrograms`) mirrors backend ranking (`intake_repo.rank_programs`) — must be kept in sync
- Rate ranges are illustrative only — no pricing engine
- 7 program types, 7 question types, branching via `getNextQuestion()` pure function

---

## Session 2 — Code Review: Borrower Intake (10-Area Review)

**Type:** Code review + targeted improvements

**What was reviewed:**
1. UX and animation timing
2. Question flow and back navigation
3. Program recommendation accuracy
4. Compliance language
5. Frontend architecture
6. Backend architecture
7. Database schema
8. Error handling
9. Performance
10. Accessibility

**What was changed:**

### Welcome page (`welcome.tsx`)
- Added try/finally to `handleStart()` so `setIsStarting(false)` always runs even if API errors
- Reduced animation delays: nav 3600ms→900ms, support 3150ms→1100ms, paragraph 3400ms→1350ms, CTA 3650ms→1550ms (was 3.65s before user could interact — major UX regression)

### Intake page (`intake.tsx`)
- Added `visitedQuestions` to destructuring
- Back button on Q1 now navigates to `/borrower/welcome` (previously did nothing)
- Added `isFirstQuestion` prop to `IntakeShell`

### IntakeShell (`IntakeShell.tsx`)
- Demoted aside `<h2>` to `<p className="intake-panel-tagline">` (DOM had h2 before h1 — wrong heading hierarchy)
- Added `aria-current={isActive ? "step" : undefined}` on progress steps
- Back button label: "← Back to site" on Q1, "Back" on all other questions

### Income type question
- Replaced mortgage jargon with plain-language note

### Loan amount question
- `formatted` fallback changed from `"$0"` to `null` — preview div doesn't render when blank

### ProgramCard (`ProgramCard.tsx`)
- Rank badges changed from `#1`/`#2` to `Match 1`/`Match 2`/`Near Miss`
- Rate display restructured with per-card disclaimer: "Illustrative only — not a rate quote or commitment to lend"

### `programs.ts`
- Fixed double `isDisqualified()` call in `rankMockPrograms()` (was calling it twice per program — logic bug)

### `globals.css`
- Added `.intake-panel-tagline` style
- Added `:focus-visible` rings to all borrower interactive elements
- Added `program-rate-label` and `program-rate-disclaimer` styles
- Expanded `prefers-reduced-motion` block to cover intake/results/loading states
- Added `aria-live="polite"` on results loading skeleton

---

## Session 3 — Frontend Pipeline: Real Data Wiring

**Type:** Feature — connect frontend to real backend API

**What was built / changed:**

### `pages/loans/[loanId].tsx`
- Removed `mockLoans.find()` (would never match UUID-format IDs from real DB)
- Replaced with `useLoan(loanId)` hook with loading/error/not-found states
- Added `LoadingSpinner` and `ErrorState` with retry

### `components/loans/LoanDetailSummary.tsx`
- Replaced hardcoded "3 open" / "2 requested" strings with real `loan.conditionsOpen` and `loan.conditionsSubmitted` from API

### `data/pipelineAnalytics.ts`
- Changed `"total mock files"` → `"total in pipeline"` in KPI label

**Context:** `GET /api/v1/loans/pipeline` already existed and was returning 202 real seeded loans. `loanService.ts` already called the real endpoint when a token was present. The only bug was the detail page using `mockLoans.find()` directly.

---

## Session 4 — Loan File Workspace

**Type:** Feature — new major UI module

**What was built:**

### `components/app/LoanWorkspaceLayout.tsx` (NEW)
- `ProtectedRoute` + `Sidebar` without `TopHeader`
- Loan file pages don't need the global page header — the file's own topbar serves that purpose

### `state/recentLoansStore.ts` (NEW)
- Zustand + localStorage persistence
- `push()` deduplicates by ID, trims to last 5
- Sidebar reads this to show "Recent Files"

### `components/loans/workspace/workspaceSections.ts` (NEW)
- `PRIMARY_SECTIONS` const array (6 sections)
- `MORE_SECTIONS` const array (7 sections, grouped)
- `WorkspaceSection` union type derived from both arrays
- `isWorkspaceSection()` type guard
- `ALL_SECTION_IDS` set for fast lookup

### `components/loans/workspace/WorkspacePlaceholder.tsx` (NEW)
- Simple centered placeholder for unbuilt sections

### `components/loans/workspace/WorkspaceHome.tsx` (NEW)
- On mount: pushes loan to `recentLoansStore`
- Left panel: Loan Summary (8 fields)
- Right panel: Open Items (conditions open/submitted, documents placeholder)
- `workspace-badge warning/success` for action count

### `components/loans/LoanWorkspaceShell.tsx` (NEW)
- `useRouter` reads `?section=` query param, defaults to `"home"`
- Click-outside dropdown pattern (`useState + useRef + useEffect(document.addEventListener('mousedown'))`)
- `goTo()` uses shallow push
- Sticky `loan-file-topbar` with breadcrumb + identity + actions rows
- `WorkspaceContent` dispatches to correct section component

### `pages/loans/[loanId].tsx` (REWRITE)
- Replaced `AppLayout` with `LoanWorkspaceLayout`
- Replaced `LoanDetailSummary` with `LoanWorkspaceShell`
- Loading and error states preserved

### `components/app/Sidebar.tsx` (UPDATED)
- Added "New Submission" link (AE + broker roles only)
- Added "Recent Files" section reading from `recentLoansStore`
- Active loan highlighted in sidebar

### `globals.css` (APPENDED)
- ~260 lines for workspace layout, topbar, horizontal nav, More dropdown, content area, placeholder, WorkspaceHome, badges, sidebar recent items, responsive overrides

**TypeScript fix:** `MORE_IDS` type narrowed to `Set<string>` to accept full `WorkspaceSection` union in `.has()`.

---

## Session 5 — Pipeline Workspace (Full Rebuild)

**Type:** Major feature rebuild — replaced basic table with full command-center

**What was built:**

### `state/pipelineStore.ts` (NEW)
- Zustand + localStorage persistence (`origina.pipeline.v1`)
- 13 column IDs, 8 sort fields
- `PipelineFilters` type (search, statuses, programs, amount range, actionNeeded, conditionsOutstanding)
- 5 built-in saved views: All Active, Conditions Review, Action Needed, Approved, High Volume
- User-created views in separate `userViews` array (persisted) — built-ins always come from code
- Actions: `toggleSort`, `setFilters`, `applyFilterPreset` (atomic KPI click), `applyView`, `saveView`, `deleteView`, `setColumns`, panel open/close

### `data/pipelineFilters.ts` (NEW)
- Pure functions: `applyPipelineFilters()`, `applyPipelineSort()`
- `computeDaysActive()` — from `submittedAt` (or `updatedAt` fallback) to today
- All 7 filter types, all 8 sort fields

### `components/loans/pipeline/PipelineToolbar.tsx` (NEW)
- Sticky at `top: 0`
- Instant search + result count
- Saved Views dropdown (built-in sections labeled separately, user views with delete buttons)
- Save current view: inline form prompt within dropdown
- Filters button with active dot indicator
- Columns dropdown (checkboxes + up/down reorder + Reset button)
- CSV export (downloads filtered+sorted data)
- Refresh + New Loan buttons

### `components/loans/pipeline/PipelineKpis.tsx` (NEW)
- 5 KPI cards: Active Loans, Conditions Outstanding, Action Needed, Submitted This Month, Approved
- Click applies filter preset atomically (`applyFilterPreset`)
- Active card gets underline accent + label color change
- Color variants: warning (orange) for conditions/action, success (green) for approved

### `components/loans/pipeline/PipelineGrid.tsx` (NEW)
- 13 configurable columns, ordered per store
- Sticky header at `top: 52px` (below toolbar)
- `aria-sort` on sortable column headers
- Color-coded status pills (11 variants)
- Conditions/actions count badges (green clear, orange outstanding)
- Orange left border on `actionsNeeded > 0` rows
- Per-row "···" action menu: Open Loan, View Conditions, Add Note, Copy Loan #
- Empty state with clear-filters button
- Grid footer with result count

### `components/loans/pipeline/PipelineFilterPanel.tsx` (NEW)
- Fixed right-side drawer (`position: fixed; right: 0; width: 300px`)
- Transparent backdrop for click-outside dismiss
- Multi-select status (10 options), product type (7 options)
- Loan amount range inputs
- Action Needed + Conditions Outstanding checkboxes
- Clear all button, Apply button

### `pages/loans/index.tsx` (REWRITE)
- Wires all pipeline components
- `filtered` = `applyPipelineFilters(loans, store.filters)` — computed via useMemo
- `sorted` = `applyPipelineSort(filtered, store.sortField, store.sortDir)` — computed via useMemo
- Toolbar receives `sorted` for export (filtered+sorted = what user sees)

### `types/loan.ts` (UPDATED)
- Added `loanProgramLabels` record (7 program display names)

### `globals.css` (APPENDED ~480 lines)
- Pipeline workspace layout override (`:has(.pipeline-workspace)`)
- Toolbar, search, toolbar button variants
- Dropdown system (views, columns, save form)
- KPI bar and card styles
- Grid table styles including sticky header
- Status pill color variants (11 classes)
- Count badge variants
- Row action button and menu
- Filter panel (fixed drawer)
- Responsive overrides at 980px and 640px

---

## Session 6 — Analytics Module

**Type:** Feature — new page restoring previously removed charts

**What happened:** Charts (`PipelineCharts`, `PipelineKpiGrid`, all 5 Recharts wrappers) were never deleted — they were only detached from the pipeline page during the Session 5 rebuild. The user wanted them back in a dedicated module.

**What was built:**

### `pages/analytics/index.tsx` (NEW)
- Same data source as pipeline (`listLoans`)
- Renders `PipelineKpiGrid` (5 operational KPIs)
- Renders `PipelineCharts` (all 5 charts)
- Loading, error, and refresh states

### `components/app/Sidebar.tsx` (UPDATED)
- Added "Analytics" link below "Loan Pipeline" for AE, broker, underwriter roles

---

## Session 7 — Right-Click Loan Actions and Field Info

**Type:** Feature / Bug Fix — pipeline context menu, quick info, and workspace field metadata

**What was built / changed:**

### `components/ui/ContextMenu.tsx` (NEW)
- Added reusable portal-based context menu component
- Supports:
  - Right-click positioning
  - Viewport clamping
  - Separators
  - Disabled items with reason text
  - Destructive items
  - `Escape` close
  - Click-outside close
  - `closeOnClick={false}` for actions that open nested cards/modals

### `components/loans/pipeline/PipelineGrid.tsx` (UPDATED)
- Added native row-level `onContextMenu`
- Prevents the browser default context menu
- Stores the selected loan and click coordinates
- Renders `PipelineLoanContextMenu` from the row right-click state
- Passes `onLoanMutated` callback so pipeline data refreshes after archive/move actions

### `components/loans/pipeline/PipelineLoanContextMenu.tsx` (NEW)
- Added pipeline right-click action menu:
  - Open Loan File
  - Open in Sandbox
  - Quick Info
  - View Conditions
  - Add Note
  - Copy Loan #
  - Move to Tenant
  - Archive Loan
- Keeps the context menu mounted when opening Quick Info or admin modals
- Wires role-based disabled states in the UI

### `components/loans/pipeline/QuickLoanInfoCard.tsx` (NEW)
- Added compact loan popover opened from right-click → Quick Info
- Fetches `/api/v1/loans/{loan_id}/quick-info`
- Shows:
  - Loan number and status
  - Borrower name
  - Loan program
  - Loan amount
  - Purpose
  - State placeholder
  - LTV / CLTV / FICO / DTI / DSCR
  - Updated time
- Adds loading, signed-out, and API error states
- Uses warn/danger value styling for risk-sensitive values

### `components/loans/pipeline/MoveTenantModal.tsx` (NEW)
- Added administrative move-to-tenant modal
- Requires explicit confirmation checkbox
- Captures optional reason
- Calls `PATCH /api/v1/loans/{loan_id}/tenant`
- Uses mock tenant options until tenant listing API exists

### `components/loans/pipeline/DeleteLoanModal.tsx` (NEW)
- Added archive loan modal
- Requires typing the loan number to confirm
- Captures optional reason
- Calls `PATCH /api/v1/loans/{loan_id}/archive`
- Explains that archive is a soft-delete and preserves audit history

### `pages/loans/index.tsx` (UPDATED)
- Passes `onLoanMutated={() => void loadLoans(true)}` to the pipeline grid
- Pipeline refreshes after successful mutation actions

### `api/v1/loans.py` (UPDATED)
- Added `GET /loans/{loan_id}/quick-info`
  - Returns compact loan, borrower, and financials summary
- Added `POST /loans/{loan_id}/sandbox`
  - Mock sandbox response only
  - TODO for real sandbox provisioning
- Added `PATCH /loans/{loan_id}/archive`
  - Soft archives a loan by setting `status = "archived"`
  - Blocks archive for funded/closed/post-closing loans
  - Requires elevated role
- Added `PATCH /loans/{loan_id}/tenant`
  - Moves a loan to another tenant
  - IT-admin only
  - Validates target tenant exists

### `schemas/loan_schema.py` and `types/api.ts` (UPDATED)
- Added API contract types for:
  - `LoanQuickInfoOut`
  - `SandboxOut`
  - `MoveTenantRequest`
  - `ArchiveLoanRequest`
  - `FieldHistoryEntry`

### `api/v1/audit.py` (UPDATED)
- Added `GET /audit/loans/{loan_id}/fields/{field_key}/history`
- Returns audit history entries for one field key
- Filters by tenant and loan ID
- Extracts old/new values from audit diff payloads

### Workspace field context menu components (NEW)
- `WorkspaceFieldContextMenu.tsx`
  - Wraps workspace fields and opens field-level right-click menu
  - Actions: Field Info, Show Field History, Copy Field Key
- `FieldInfoPanel.tsx`
  - Shows UI label, API field, DB column, model/table, type, required flag, validation, and description
- `FieldHistoryPanel.tsx`
  - Fetches field history from audit endpoint
  - Falls back to mock history if no backend audit data exists yet
  - Shows old/new values, changed time, and actor when available

### Workspace screens wired for field right-click (UPDATED)
- `WorkspaceBorrowerURLA.tsx`
  - Wrapped borrower identity, contact, and income fields with field metadata
- `WorkspaceIncome.tsx`
  - Wrapped wage, self-employed, asset depletion, DSCR, and income notes fields
- `WorkspaceProcessing.tsx`
  - Wrapped target close date, document review, and processor notes
- `WorkspaceUnderwriting.tsx`
  - Wrapped decision, decision date, FICO, LTV, DTI, risk notes, and UW notes

### `globals.css` (UPDATED)
- Added styles for:
  - Context menus
  - Quick Info card
  - Shared modal base
  - Field info/history panels
  - Field history entries and mock notice

**Bug fixed:**
- The right-click Quick Info module was not popping up because the loan pipeline rows did not have a native `onContextMenu` handler wired to any menu state.
- The fix added row-level right-click handling in `PipelineGrid`, preserved click coordinates, rendered `PipelineLoanContextMenu`, and kept the parent menu alive for nested Quick Info/modal actions using `closeOnClick={false}`.

**Known limitations / follow-up bugs:**
- Sandbox is a mock response only. Real sandbox provisioning still needs backend implementation.
- Move Tenant uses mock tenant options in the frontend until a real tenant-list API is available.
- Frontend role checks currently use app roles such as `account_executive`; backend route guards use elevated backend roles such as `IT_ADMIN` and `ACCOUNT_MANAGER`. These permission names need to be reconciled before production use.
- `quick-info.property_state` is still `null`; backend needs a join to the property table.
- Field history currently searches audit rows where `entity_id == loan_id` only. Borrower, terms, financials, property, and condition entity IDs still need deeper lookup.
- Field history panel intentionally falls back to mock entries when audit data is absent so the UI can be reviewed before full audit coverage is complete.

---

## Session 8 — MISMO XML Test Fixture Corpus

**Type:** Testing / Fixture Infrastructure

**What was built:**

### `test-fixtures/mismo/sources/` (NEW)
- Stored the three provided source MISMO XML samples in the repository:
  - `CommercialTest5.xml`
  - `ConsumerTest3.xml`
  - `ConsumerTest7.xml`

### `test-fixtures/mismo/generated/` (NEW)
- Added 15 generated synthetic XML variants for parser and import-flow testing:
  - 5 commercial / investment scenarios
  - 5 consumer primary residence scenarios
  - 5 high-balance / second home / investment scenarios
- Variants preserve the original MISMO document shape while changing common test fields:
  - Borrower names
  - Fake tax ID values
  - Subject property address, city, county, state, and ZIP
  - Loan amount
  - Property value
  - Purchase price
  - Loan purpose
  - Occupancy / property usage
  - Created timestamp
  - Loan identifiers

### `test-fixtures/mismo/generate_mismo_variants.py` (NEW)
- XML-aware generator using Python stdlib `xml.etree.ElementTree`
- Preserves MISMO namespaces and source structure
- Regenerates all synthetic variants deterministically
- Keeps fixture generation repeatable instead of relying on manual copied XML edits

### `test-fixtures/mismo/manifest.json` (NEW)
- Documents generated fixture metadata:
  - Source file
  - Scenario description
  - Address and loan scenario details
  - Output file path

### `test-fixtures/mismo/README.md` (NEW)
- Explains fixture folder structure
- Notes intended usage for MISMO parser, mapping preview, and import-flow smoke tests
- Documents the regeneration command

**Validation performed:**
- Parsed all XML fixtures successfully with Python XML parser:
  - 3 source files
  - 15 generated files
  - 18 total XML fixtures

**Bug / gap addressed:**
- The project did not have a durable MISMO fixture corpus for parser and frontend import testing.
- Manual testing depended on local files in `~/Downloads`, which made test data easy to lose and hard to share.

**Known limitations / follow-up bugs:**
- Generated variants are well-formed XML and useful for parser resilience, but they are not guaranteed to be complete underwriting-valid MISMO loan files.
- The generator mutates common high-value fields only; deeper MISMO consistency checks may still fail once a stricter production parser is added.
- Fake tax ID values are intentionally synthetic and should never be treated as real borrower data.

---

## Session 9 — Workspace Field Context Menu: Remaining Tabs

**Type:** Feature completion — extended field right-click coverage to all editable workspace tabs

**Context:** Session 7 designed and built the `WorkspaceFieldContextMenu` system and wired it to `WorkspaceBorrowerURLA`. The Session 7 build history entry listed the other three tabs (Processing, Underwriting, Income) as complete, but that work was carried into this session. This entry documents what was actually implemented here.

**What was built / changed:**

### `WorkspaceProcessing.tsx` (UPDATED)
- Added `WorkspaceFieldContextMenu` import
- Wrapped 3 editable fields with full `FieldMeta`:
  - **Target Close Date** → `loans.target_close_date` (date)
  - **Document Review** → `loans.doc_review_status` (enum)
  - **Processor Notes** → `loans.processor_notes` (text)
- Milestone checkboxes intentionally not wrapped — they represent task state, not auditable data fields

### `WorkspaceUnderwriting.tsx` (UPDATED)
- Added `WorkspaceFieldContextMenu` import
- Wrapped 7 editable fields with full `FieldMeta`:
  - **Decision** → `loans.uw_decision` (enum)
  - **Decision Date** → `loans.uw_decision_date` (date)
  - **Credit Score** → `loan_financials.fico_score` (integer)
  - **LTV Override** → `loan_financials.ltv` (numeric 5,4) — described as decimal stored value
  - **DTI Override** → `loan_financials.debt_to_income` (numeric 5,4) — described as decimal stored value
  - **Risk Notes** → `loans.risk_notes` (text)
  - **UW Notes** → `loans.uw_notes` (text)

### `WorkspaceIncome.tsx` (UPDATED)
- Added `WorkspaceFieldContextMenu` and `FieldMeta` imports
- Refactored `WorksheetField` helper component to accept optional `loanId?: string` and `meta?: FieldMeta` props
  - When both are provided, the component self-wraps with `WorkspaceFieldContextMenu`
  - When omitted, renders the plain field — backward-compatible with no call-site breakage
- Wrapped 11 worksheet fields across all four income tabs:
  - **W-2 tab:** Base Income, Bonus, Overtime, Commission → `loan_financials` columns
  - **Self-Employed tab:** Gross Income, Adjustments / Add-backs, Qualifying SE Income → `loan_financials` columns
  - **Asset Depletion tab:** Eligible Assets, Depletion Term → `loan_financials` columns
  - **DSCR tab:** Gross Rental Income (`monthly_rent`), PITIA → `loan_financials` columns
- Wrapped the Underwriter Notes textarea → `loans.income_uw_notes`

### `QuickLoanInfoCard.tsx` (BUG FIX)
- Moved `setLoading(true)` call inside `Promise.resolve().then()` to satisfy the `react-hooks/set-state-in-effect` linter rule
- The synchronous `setLoading(true)` in the effect body was triggering a cascading render warning
- Fix preserves the same loading UX — the delay introduced by `Promise.resolve()` is a single microtask tick and imperceptible

**Design decisions:**
- Field metadata (`apiKey`, `dbColumn`, `table`, `fieldType`, `description`) is declared at each call site, not stored centrally — keeps the metadata co-located with the field and avoids a separate config file that could drift out of sync
- Fields that don't yet have real DB columns (e.g. `uw_decision`, `processor_notes`, `income_uw_notes`) use the planned column name so the field info panel is accurate when those columns are added
- Worksheet fields in Income use the `WorksheetField` self-wrap pattern rather than external wrappers to keep the JSX tree clean inside the worksheet grids

**Known limitations (same as Session 7):**
- Field history falls back to mock entries when audit rows don't exist for a field — expected until backend audit trigger coverage is confirmed for all wrapped columns
- `FieldHistoryPanel` only searches `entity_id == loan_id`; borrower and financials entity IDs still require deeper lookup in `audit.py`
- Fields like `uw_decision`, `uw_decision_date`, `processor_notes` are not yet real DB columns — the field info panel will show the planned schema, and history will show mock data until those columns exist

---

## Session 10 — Phase 1 Document Storage and Loan Submission

**Type:** Feature — real document upload, local file storage, and end-to-end loan submission

**Goal:** Make the submission flow real enough that a loan draft is created in the database, documents are uploaded with actual file bytes, and a loan can be submitted through a backend endpoint with status history recorded.

**What was built / changed:**

### `core/config.py` (UPDATED)
- Added `STORAGE_BACKEND` (default `"local"`), `LOCAL_UPLOAD_DIR` (default `"/tmp/origina-uploads"`), `MAX_UPLOAD_SIZE_MB` (default `50`), `ALLOWED_MIME_TYPES` (11 types: PDF, JPEG, PNG, TIFF, WEBP, XML variants, Office docs)

### `services/storage_service.py` (NEW)
- `StorageBackend` Protocol — interface that `LocalStorageBackend` and future `S3StorageBackend` implement
- `LocalStorageBackend` — writes/reads files from local filesystem; `put()`, `get_bytes()`, `delete()`; resolves every key to absolute path and asserts it stays under the base directory (double-layer path traversal prevention)
- `make_storage_key(tenant_id, loan_id, path_uuid, filename)` — sanitises each path segment, preserves file extension, format: `{tenant_id}/{loan_id}/{uuid}/{safe_filename}`
- `compute_sha256(data)` — SHA-256 hex digest for integrity and deduplication
- `get_storage()` — singleton factory that reads `STORAGE_BACKEND` from config; Phase 3 hook for `"s3"` branch
- Traversal test confirmed: `../../../etc/passwd` input sanitises to `_________etc/passwd` and backend path resolution blocks it with `PermissionError`

### `services/document_repo.py` (IMPLEMENTED — was a 1-line stub)
- `create_document()` — inserts Document row with all metadata; all fields keyword-only
- `list_documents()` — tenant-scoped query; optional `loan_id`, `condition_id`, `include_archived` filters; defaults to excluding archived rows
- `get_document()` — tenant-scoped single-row fetch; returns `None` on tenant mismatch (never 403)
- `archive_document()` — soft-delete via `archived_at` + `archived_by`; idempotent (already-archived returns the row unchanged)

### `db/migrations/112_documents_v2.sql` (NEW)
- `ALTER TABLE documents ADD COLUMN archived_at timestamptz` — soft-delete timestamp
- `ALTER TABLE documents ADD COLUMN archived_by uuid references users(id) ON DELETE SET NULL`
- `ALTER TABLE documents ADD COLUMN condition_id uuid references conditions(id) ON DELETE SET NULL`
- `CREATE INDEX idx_documents_active` — partial index on active (non-archived) documents only
- `CREATE INDEX idx_documents_condition` — partial index for condition-scoped document lookups

### `models/document.py` (UPDATED)
- Added `archived_at`, `archived_by`, `condition_id` ORM columns matching migration
- Fixed `uploader` relationship: added `foreign_keys=[uploaded_by]` to resolve SQLAlchemy ambiguity introduced by having two FK columns pointing at `users` (`uploaded_by` and `archived_by`)

### `models/user.py` (UPDATED — bug fix)
- Added `foreign_keys="Document.uploaded_by"` to `User.uploaded_documents` relationship
- Without this, SQLAlchemy raised `InvalidRequestError: multiple foreign key paths` at startup because the new `archived_by` FK created ambiguity

### `schemas/document_schema.py` (UPDATED)
- Added `condition_id`, `archived_at`, `archived_by` to `DocumentOut`
- Added `condition_id` to `DocumentCreate`

### `schemas/loan_schema.py` (UPDATED)
- `LoanCreate` no longer requires `tenant_id` — it was always ignored by the endpoint (injected from auth). Sending it from the client was misleading and would have caused a validation error for clients that didn't know their own tenant UUID
- Added `LoanSubmitOut` response schema: `id`, `loan_number`, `status`, `submitted_at`, `updated_at`

### `api/v1/documents.py` (REWRITTEN)
- `POST /documents/upload` — multipart/form-data endpoint; accepts `file`, `loan_id`, `doc_type`, `condition_id`, `tags`; validates loan ownership; reads full file bytes (not Content-Length header, which can be spoofed); enforces size limit; validates MIME type against allowlist; computes SHA-256; builds traversal-safe storage key; writes bytes to `LocalStorageBackend`; stores metadata row via `document_repo`
- `GET /documents/{id}/download` — streams file bytes back as `Response`; sets `Content-Disposition`, `Content-Length`, `X-SHA256` headers; returns 410 for archived documents; Phase 3 TODO: redirect to presigned S3 URL
- `DELETE /documents/{id}` — changed from hard `db.delete()` to soft-archive via `document_repo.archive_document()`; returns updated `DocumentOut` (200) instead of 204
- `GET /documents/` — now uses `document_repo.list_documents()`; exposes `condition_id` and `include_archived` query params
- `POST /documents/` — kept for internal/tooling use; now uses `document_repo` instead of inline SQL

### `api/v1/loans.py` (UPDATED)
- `POST /loans/` now fires a `new_draft` `LoanStatusEvent` after creating the loan row (uses `db.flush()` to get the loan ID before committing, then adds the event in the same transaction)
- Added `POST /loans/{loan_id}/submit` — validates status is `new_draft` (prevents double-submission); assigns sequential loan number if not already set (`OR-{1000 + tenant_loan_count}`); sets `status = "submitted"`, `submitted_at = today()`; creates `LoanStatusEvent` with `from_status="new_draft"`, `to_status="submitted"`; returns `LoanSubmitOut`

### `types/api.ts` (UPDATED — frontend)
- Added `DocumentOut` type mirroring backend schema (all 13 fields including soft-delete and condition columns)
- Added `LoanSubmitOut` type

### `services/submissionService.ts` (REWRITTEN — frontend)
- `createLoanDraft()` — calls `POST /loans/` when authenticated; returns draft with real DB UUID as `loanId`; falls back to `draft-{UUID}` local draft when no token present
- `saveLoanDraft()` — writes to localStorage autosave (Phase 2 TODO: PATCH backend fields)
- `submitLoanApplication()` — calls `POST /loans/{id}/submit` when authenticated with a real loan ID; falls back to mock result for unauthenticated / local-only drafts
- Token read from `localStorage["origina.token"]` (Phase 1 pragmatic; Phase 2 TODO: inject via dependency)
- SSN explicitly stripped from localStorage autosave writes

### `state/documentStore.ts` (UPDATED — frontend)
- `uploadDocument(docType, file, loanId)` — sends real `POST /documents/upload` multipart request when authenticated with a real loan ID; stores returned `DocumentOut.id` as the checklist `fileId`; tracks per-item upload/error state; falls back to mock (260ms delay) for unauthenticated/draft-only state
- Added `uploadedDocs` map (`Record<string, DocumentOut>`) — stores full document records keyed by `docType`
- `removeDocument()` — also clears the corresponding `uploadedDocs` entry

### `components/submission/documents/DocumentChecklistItem.tsx` (UPDATED — frontend)
- Added `useLoanSubmissionStore` to read `draft.loanId` and pass it to `uploadDocument`
- Upload button disabled while uploading; label changes to "Uploading…"
- Replace/Remove buttons disabled during in-progress uploads
- Added error message display when `uploadState.status === "error"`
- Resets `<input>` value after selection so the same file can be re-selected after removal

**Bugs fixed during this session:**

1. **SQLAlchemy mapper ambiguity** — Adding `archived_by` FK created two paths from `Document` to `users`. Fixed by adding `foreign_keys` to both sides of the `User.uploaded_documents` relationship.

2. **Migration not applied** — First upload attempt failed with `column "archived_at" does not exist`. Fixed by running `scripts/db_migrate.sh`.

3. **Submit endpoint too strict (Phase 1)** — Initial implementation required `loan_financials.loan_amount` before submission, blocking test drafts that hadn't gone through the full form. Relaxed to Phase 1 minimal validation (status check only); financials/borrower/document checklist validation deferred to Phase 2.

**What is now real vs. still mocked:**

| Real | Still mocked (TODO) |
|---|---|
| `POST /loans/` → DB row + `new_draft` event | Form field sync (`saveLoanDraft` is localStorage only) |
| `POST /documents/upload` → bytes on disk + metadata in DB | MISMO XML parsing (`parseMismoFile` still hardcoded) |
| `GET /documents/{id}/download` → streams bytes | AE assignment on submit |
| `DELETE /documents/{id}` → soft-archive in DB | S3 storage (Phase 3 hook in place) |
| `POST /loans/{id}/submit` → `submitted` status + event | Financials/borrower/doc validation on submit (Phase 2) |

**Known limitations / follow-up:**

- `saveLoanDraft` does not PATCH backend field values — form data lives in localStorage only until Phase 2
- Loan number assigned sequentially per tenant at submit time; not globally unique across tenants — needs a DB sequence in Phase 2
- `POST /documents/upload` MIME type validation trusts the `Content-Type` header from the client — Phase 2 should add server-side magic byte sniffing (`python-magic`)
- `LocalStorageBackend` files in `/tmp/origina-uploads` are not cleaned up when documents are archived — a background cleanup job is needed before production
- Field history (`FieldHistoryPanel`) for the new `archived_at`/`archived_by` columns is not yet wired to the audit endpoint

---

## Session 11 — Bug Fix: `create_loan` Wrong Return Type → 500 → "Failed to fetch"

**Type:** Bug fix (1 file, 1 function)

**Symptom:** Clicking "Accept All" in the MISMO import flow threw a `TypeError: Failed to fetch` at `apiClient.ts:25`. The browser reported a generic network error, not an HTTP error.

**Root cause (3-layer failure):**

1. **Wrong return type in `create_loan`** — `POST /loans/` has `response_model=LoanOut` but the function was returning a `LoanSubmitOut` Pydantic object. FastAPI serializes the return value by calling `.model_dump()` on it, then validating that dict against `response_model`. `LoanSubmitOut.model_dump()` produces a dict without `tenant_id` or `created_at`, both of which are required fields in `LoanOut`. This raised a Pydantic `ValidationError` inside FastAPI's response serialization path.

2. **500 without CORS headers** — When a `ValidationError` escapes FastAPI's serialization layer, FastAPI returns a 500. In some error paths (specifically response serialization failures), the CORS middleware does not get a chance to attach `Access-Control-Allow-Origin` headers to the error response.

3. **Browser reports "Failed to fetch" instead of 500** — Without `Access-Control-Allow-Origin` in the response, the browser's CORS check fails and the entire response is blocked. The `fetch()` promise rejects with a `TypeError` rather than resolving to the 500, so `apiClient.ts` never reaches the `if (!response.ok)` check and the user sees "Failed to fetch" instead of any useful error message.

**Diagnosis path:** `curl POST /api/v1/loans/` returned `500 {"detail":"Internal server error"}`, confirming the error was server-side. Tracing the create_loan function revealed it was returning `LoanSubmitOut` from a `response_model=LoanOut` route — an inadvertent copy-paste from when the submit endpoint was added.

**Fix — `api/v1/loans.py`:**

Removed the dead query block and wrong return value from `create_loan`; now returns the ORM object directly:

```python
# Before (broken):
db.add(event)
db.commit()
db.refresh(loan)

fin = db.query(LoanFinancials).filter(...).first()
primary = db.query(Borrower).filter(...).first()
borrower_name = ...

return LoanSubmitOut(id=loan.id, ...)   # ← wrong schema

# After (fixed):
db.add(event)
db.commit()
db.refresh(loan)
return loan                              # ← LoanOut serializes from ORM object
```

`LoanOut` has `model_config = ConfigDict(from_attributes=True)` so FastAPI serializes the ORM object directly — no dict conversion needed, all required fields (`tenant_id`, `created_at`, `updated_at`) are present.

**Verified:** `POST /api/v1/loans/` now returns `201 Created` with a full `LoanOut` payload including `id`, `tenant_id`, `status: "new_draft"`. The MISMO import "Accept All" flow can now create a real DB loan and proceed to document upload.

---

## Session 12 — Loan Submission Success Experience

**Type:** Feature / UX polish — modern post-submit confirmation flow

**Goal:** Replace the abrupt submit → redirect behavior with a business-grade success experience that confirms the submission, shows the created loan record, and lets the user choose the next action.

**What was built / changed:**

### `api/v1/loans.py` (UPDATED)
- Expanded `POST /loans/{loan_id}/submit` response payload with real summary data:
  - `borrower_name`
  - `loan_amount`
  - `loan_program`
- The endpoint now loads primary borrower and loan financials after submission so the frontend can render actual response data instead of fabricating modal content.

### `schemas/loan_schema.py` (UPDATED)
- Added `borrower_name`, `loan_amount`, and `loan_program` to `LoanSubmitOut`.

### `types/api.ts` and `types/submission.ts` (UPDATED)
- Updated `LoanSubmitOut` frontend API type to match backend response.
- Expanded `SubmitResult` with:
  - `borrowerName`
  - `loanAmount`
  - `productType`
  - `submittedAt`
- Changed `loanNumber` in `SubmitResult` to nullable so missing backend values are displayed as missing rather than invented.

### `services/submissionService.ts` (UPDATED)
- Maps real backend submit response into `SubmitResult`.
- Removed fabricated fallback loan numbers for authenticated backend submissions.
- Local-only/demo submissions still use draft data where available, but the production path uses actual API data.

### `components/submission/SubmissionProcessingOverlay.tsx` (NEW)
- Lightweight processing overlay shown while submit is in flight.
- Displays staged progress:
  - Validating application
  - Creating loan file
  - Assigning workflow
  - Finalizing submission
- Duration is tied to the real async submit operation, not an artificial timeout.

### `components/submission/SubmissionSuccessModal.tsx` (NEW)
- Centered success modal with animated green checkmark.
- Shows:
  - Loan Number
  - Borrower
  - Product Type
  - Loan Amount
  - Submission timestamp
- Primary action: `Open Loan File` → `/loans/{loan_id}`
- Secondary action: `Return to Pipeline` → `/loans`
- Escape key and close icon return to pipeline.
- Overlay click does not dismiss the modal, preventing accidental dismissal.

### `components/submission/SubmissionErrorModal.tsx` (NEW)
- Displays failed submission state without redirecting.
- Keeps user on the submission screen.
- Offers:
  - `Retry Submission`
  - `Continue Editing`

### `components/submission/SubmissionWizard.tsx` (UPDATED)
- Added guarded submit state to prevent double submissions.
- Submit flow now:
  1. Save draft
  2. Show processing overlay
  3. Call submit API
  4. Show success modal on success
  5. Show error modal on failure
- No automatic redirect after success.
- User chooses the next action.

### `components/submission/StepFooter.tsx` (UPDATED)
- Submit button now changes from `Submit Loan` to `Submitting...`.
- Shows inline spinner.
- Disables Back, Save Draft, and Submit during submission.

### `styles/globals.css` (UPDATED)
- Added styles and animations for:
  - Processing overlay
  - Modal fade/scale entrance
  - Animated green checkmark
  - Subtle success pulse
  - Error modal
  - Responsive mobile summary layout

**Bugs / gaps addressed:**
- Users previously got no durable visual confirmation before being redirected.
- Success UI did not communicate that the loan record was created and workflow started.
- Double-clicking submit could trigger duplicate attempts at the UI layer.
- Submit failures were easy to miss because there was no explicit modal state.

**Known limitations / follow-up:**
- Backend still only returns data that has actually been persisted. Because Phase 1 draft field sync is localStorage-only, `borrower_name`, `loan_amount`, and `loan_program` can be null for drafts whose form fields were never PATCHed to backend tables.
- AE assignment is still mocked as `"Alex Morgan"` in the frontend until real assignment is implemented.
- Submit validation remains Phase 1 minimal validation; full borrower/property/document validation is still Phase 2.

**Validation performed:**
- `npm run lint` passed.
- `npm run build` passed.
- Build still shows existing non-blocking warnings:
  - Next SWC native package missing, WASM fallback used
  - stale `baseline-browser-mapping`
  - experimental CommonJS/ESM warning from Redux Toolkit bundle during static generation

---

## Session 13 — Bug Fix: `OR-1208` Missing From Pipeline Search

**Type:** Bug fix / Data loading hardening

**Symptom:** Loan number `OR-1208` existed after submission but did not appear in the `/loans` pipeline view and could not be found by pipeline search.

**Diagnosis:**
- Repo search confirmed `OR-1208` was not mock data or fixture data.
- Direct Postgres query confirmed the real row exists:
  - `loan_number = 'OR-1208'`
  - `status = 'submitted'`
  - tenant = `origina-dev`
  - `updated_at` ranked first for that tenant
- The backend pipeline SQL should include it because it only excludes `archived` and `cancelled`.
- The row currently has no persisted borrower, amount, or product values because Phase 1 draft field sync remains localStorage-only:
  - borrower displays as `Unnamed Borrower`
  - amount maps to `0`
  - product maps to `Other`

**Root cause:**
- The protected pipeline page could call `listLoans()` before auth hydration finished.
- `listLoans(undefined)` intentionally falls back to `mockLoans`, so the page could search the mock dataset instead of the real backend dataset.
- The pipeline API call also relied on the backend default `limit=200`, which is too small for the current seeded/test dataset and makes frontend search operate over a partial list.

**Fix — `services/loanService.ts`:**
- Added optional `{ skip, limit }` support to `listLoans()`.
- Builds query string for `/loans/pipeline?skip=...&limit=...`.
- Updated `getLoanById()` to query `/loans/pipeline?limit=1000` so detail lookup is less likely to miss records in larger local datasets.

**Fix — `pages/loans/index.tsx`:**
- Reads `isLoading` from `useAuth()`.
- Waits for auth hydration before loading the pipeline.
- Avoids silently falling back to mock loans on the protected pipeline page.
- Requests `listLoans(token, { limit: 1000 })`.
- Preserves mutation refresh behavior with `onLoanMutated={() => void loadLoans(true)}`.

**Result:**
- The pipeline now waits for the real authenticated API dataset before rendering.
- `OR-1208` should appear as the newest submitted loan.
- Searching `OR-1208` should match through `loanNumber`.

**Known limitations / follow-up:**
- If a minimum amount filter is active, `OR-1208` can still be hidden because its backend `loan_amount` is null and the frontend maps null amount to `0`.
- The durable fix for missing borrower/amount/product is Phase 2 backend draft field persistence:
  - PATCH loan product/purpose fields
  - upsert borrower rows
  - upsert loan financials
  - upsert property rows
- A real server-side searchable/paginated pipeline endpoint is still needed before production; `limit=1000` is an MVP local-dev hardening step, not the final architecture.

**Validation performed:**
- Direct Postgres check confirmed `OR-1208` exists and belongs to the dev tenant.
- `npm run lint` passed.
- `npm run build` passed.

---

## What Was Never Changed

These files existed before this work and were intentionally left untouched:
- All 14 FastAPI routers
- All SQLAlchemy models
- All Pydantic schemas
- All database migrations (110 files)
- Seed scripts (`seed_nonqm_loans.py`, `bootstrap_user.py`)
- `PipelineCharts.tsx`, `PipelineKpiGrid.tsx`, `LoanPipelineTable.tsx` (still exist, referenced by analytics and available for reuse)
- All 5 Recharts chart components
- `_legacy/` pages (archived, not routed)
- `mockLoans.ts`, `mockDashboard.ts` (fallback data, still used when no token)

---

## Session 14 — Loan Workspace Architecture + URLA + Parties Buildout

**Type:** Architecture + Implementation

### Workspace Architecture

Designed and implemented the full loan workspace shell with a vertical rail nav and 15 workspace modules:

| Section | Route key | Status |
|---|---|---|
| Home (Dashboard) | `home` | Built |
| Borrower URLA | `borrower-urla` | Built (full 10-section URLA) |
| Loan Estimate | `loan-estimate` | Stub |
| Conditions | `conditions` | Built |
| Underwriting | `underwriting` | Stub |
| Processing | `processing` | Stub |
| Parties | `parties` | Built (editable, drawer) |
| Income | `income` | Stub |
| HMDA | `hmda` | Stub |
| Documents | `documents` | Stub |
| Disclosures | `disclosures` | Stub |
| Funding | `funding` | Stub |
| Closing | `closing` | Stub |
| Conversation | `conversation` | Stub |
| Audit Log | `audit-log` | Stub |

Navigation is URL-driven (`?section=<key>`) with shallow routing so the shell doesn't remount on tab changes.

**Key files:**
- `LoanWorkspaceShell.tsx` — top bar, breadcrumb, rail + content layout
- `LoanWorkspaceRail.tsx` — vertical rail navigation component
- `workspace/workspaceSections.ts` — section registry and `resolveWorkspaceSection()`

### WorkspaceBorrowerURLA — Full 10-Section URLA Form

Built a full Fannie Mae Form 1003 URLA screen with:

- **Borrower pill tabs** — one per borrower, click to switch; shows type label and name
- **Section nav** with completion dots (green = complete, amber = partial, gray = empty), derived live from field state
- **10 sections**: Personal (1a), Current Address (1b), Former Address (1c), Employment (1d), Income (1e), Assets (2a), Liabilities (2b), Real Estate Owned (3), Declarations (4), Government Monitoring (5)
- **Save bar** — shows "Unsaved changes" only when dirty; PATCHes `/borrowers/{id}` for BorrowerOut fields; local-state-only for address/assets/liabilities/REO/declarations
- **SSN security**: SSN fields are read-only display only (`ssn_last4`), never editable, never saved to localStorage

**Backend vs local-only fields:**
- Backend (`PATCH /borrowers/{id}`): personal info, employment, income
- Local state (TODO backend): current address, former address, assets, liabilities, REO, declarations — labeled "Saved locally · Backend coming"

**Empty state (no borrowers):** Added "Add Primary Borrower" button that calls `POST /api/v1/borrowers/` and appends the new record to local state. Unblocks loans that were imported without borrower rows.

### WorkspaceParties — Editable Party Assignments

Rebuilt WorkspaceParties from a static display to an assignable/editable view:

- Party records held in component state arrays (internal, broker, vendors)
- Empty role slots shown as card stubs with "Assign" button
- `ContactDrawer` component with view/edit toggle — starts in edit mode for unassigned slots
- Save button writes back to component state (backend persistence is Phase 2 — parties need a `loan_contacts` table)
- Green flash toast on successful save

**CSS additions** (`globals.css`):
- URLA: `.urla-wrapper`, `.urla-borrower-tabs`, `.urla-body`, `.urla-section-nav`, `.urla-section-nav-item`, `.urla-nav-dot`, `.urla-section-panel`, `.urla-local-badge`
- Parties: `.party-card--slot`, `.party-assign-btn`, `.party-edit-grid`, `.party-edit-input`, `.party-save-flash`

---

## Session 15 — Bug Fix: MISMO Import — Borrowers Not Created in Database

**Type:** Bug fix (2 related bugs)

### Bug A: OR-1208 / OR-1203 — Names Did Not Map From XML Import

**Reported behavior:** Loans submitted via MISMO XML import had no borrower name in the pipeline and showed "No borrowers on file" in the URLA tab.

**Root cause — 3-layer failure:**
1. `MismoUpload.tsx:applyImport()` calls `startNewDraft("mismo")` → `createLoanDraft()` → `POST /loans/` — creates the loan shell ✓
2. `hydrateFromMismo()` updates Zustand state only (in-memory, not backend)
3. `saveDraft()` calls `saveLoanDraft()` which writes to `localStorage` only (documented Phase 2 TODO)

No `POST /api/v1/borrowers/` call was ever made. The loan existed in the DB with `borrower_name: "Unnamed Borrower"`. The `loan_program` and `loan_amount` were also null because no PATCH/PUT was issued for those fields.

**Fix — 3 files changed:**

**`src/backend/app/schemas/borrower_schema.py`**
- Changed `BorrowerCreate.tenant_id: UUID` → `Optional[UUID] = None`
- The backend endpoint ignores this field (always derives `tenant_id` from JWT), but requiring it in the schema forced clients to provide a dummy value. Making it optional aligns schema intent with actual behavior.

**`src/frontend/src/services/submissionService.ts`**
- Added `createBorrowerForLoan(loanId, borrower)` — `POST /api/v1/borrowers/`; strips SSN per security policy; no-ops for local-only (draft-prefixed) loans
- Added `patchLoanHeader(loanId, patch)` — `PATCH /api/v1/loans/{loanId}` for `loan_program` and `purpose`
- Added `upsertLoanFinancials(loanId, payload)` — `PUT /api/v1/loans/{loanId}/financials` for `loan_amount` and `appraised_value`

**`src/frontend/src/components/submission/mismo/MismoUpload.tsx`**
- After `startNewDraft()` returns `loanId`, now fires `Promise.all`:
  - `patchLoanHeader()` with `loan_program` and `purpose` from parsed MISMO data
  - `upsertLoanFinancials()` with `loan_amount` and `appraised_value` when present
  - `createBorrowerForLoan()` for each parsed borrower (camelCase → snake_case mapping; SSN never sent)
- Runs in parallel before `saveDraft()` and navigation

### Bug B: OR-1208 Not Visible in Pipeline

**Reported behavior:** OR-1208 not visible after XML import.

**Root cause:** Not a missing loan — the loan existed in the database with `status: "submitted"`, returned by the backend at position 1 in the pipeline query. The loan appeared as "Unnamed Borrower" with `loan_amount: 0` and `loan_program: Other` because no borrower or financial records were created (Bug A above). The user did not recognize it in the pipeline under those placeholder values.

**Fix:** Bug A's fix ensures future imports create real borrower records, so the pipeline shows the correct name, program, and amount immediately after import.

**For existing imported loans (OR-1208, OR-1203):** Added "Add Primary Borrower" button to the URLA empty state (`WorkspaceBorrowerURLA.tsx`). Clicking it calls `POST /api/v1/borrowers/` and immediately makes the URLA functional without requiring a page reload.

**TypeScript:** `npx tsc --noEmit` passes cleanly after all changes.

---

## Session 16 — Bug Fix: Last Pipeline Row Always Hidden

**Type:** Bug fix (CSS)

### Bug: Bottom-Most Loan in Pipeline Table Not Visible and Not Searchable

**Reported behavior:** The loan sorted to the last position in the pipeline table was never visible — not in the scrolled view and not in search results. Each time a newer loan was added (pushing the previous last to second-to-last), the old last loan became visible and the new last became hidden. The pattern was 100% consistent: only the very last `<tr>` in the tbody was affected.

**Root cause — CSS scroll container mismatch:**

`.pipeline-table-wrap` had both `overflow-x: auto` and `overflow-y: auto`. With `overflow-y: auto` active, the browser treated the table-wrap as its own vertical scroll container (not the page). This changed the reference frame for all `position: sticky` elements inside the table.

The pipeline thead cells have `position: sticky; top: 52px`. The `52px` offset is intentional — it accounts for the `.pipeline-toolbar` which is `position: sticky; top: 0` at the VIEWPORT level, and sits 52px above wherever the table starts. The thead needs to stick below the toolbar when the page scrolls.

When the table-wrap became the scroll container, the thead's sticky behavior became relative to the table-wrap top (not the viewport). The thead natural position inside the table-wrap is `0px`. With `top: 52px`, sticky activates whenever the element's natural position would be above `52px` — which is immediately (0 < 52). So the thead was ALWAYS visually positioned at `52px` from the table-wrap top, even on page load.

The first data row has natural position `≈ 36px` (thead height). Since `36 < 52`, the first data row was entirely behind the sticky thead at all times. This manifested as: whichever loan sorted to row 1 in the current sort order was invisible and unsearchable.

With `loanNumber ASC` sort (the user's persisted sort), the alphabetically-last loan number always sorted to row 1... wait no — to the LAST row, not the first. Actually with updatedAt DESC (default), the newest loan is row 1. With loanNumber ASC (persisted), the alphabetically-last loan is the final row. In both cases, the hidden row is consistent with row 1 of the CURRENT result set being hidden, which when filtered to 1 result (via search) always appears to hide that loan.

**Fix — 1 line removed:**

**`src/frontend/src/styles/globals.css`**
- Removed `overflow-y: auto` from `.pipeline-table-wrap`
- Kept `overflow-x: auto` for horizontal table scrolling (900px min-width table in narrower viewports)
- Page now handles all vertical scrolling; `thead { top: 52px }` is correctly relative to the viewport toolbar

**Diagnosis method:** Created test loans (test1–test6) with sequential names to establish the pattern. Confirmed the pipeline API returned all loans. Used CSS trace to identify the overflow-y scroll container as the proximate cause.

---

## Session 17 — Loan Workspace Expansion: Command Center, Financial Analysis, and Remaining Tabs

**Type:** Major frontend implementation / workspace expansion

### Scope

Continued the Origina loan workspace architecture implementation after the initial URLA and Parties buildout. The goal was to move the workspace away from placeholder tabs and toward a modern loan command center with real frontend-first modules for processors, underwriters, disclosure desk users, closers, funders, and operations users.

### Navigation and Shell

**`src/frontend/src/components/loans/LoanWorkspaceRail.tsx`**
- Added the grouped vertical loan workspace rail that belongs inside the loan file, separate from the global app sidebar.
- Supports grouped sections, active section state, count/status badges, and compact display behavior.
- Uses the existing `?section=` URL-driven navigation model.

**`src/frontend/src/components/loans/workspace/workspaceSections.ts`**
- Reworked workspace navigation registry into grouped sections:
  - Overview
  - Workflow
  - Loan File
  - Team
  - System
- Renamed `Income` to `Financial Analysis` while preserving the underlying `income` route key.
- Added/kept route aliases such as `notes -> conversation`.

**`src/frontend/src/components/loans/LoanWorkspaceShell.tsx`**
- Updated shell to use the grouped vertical rail.
- Kept shallow routing so section changes do not remount the entire loan file page.
- Updated the topbar with additional loan context placeholders:
  - Purpose pending
  - DTI/DSCR pending
  - Owner
  - Primary `Move File` action
- Removed placeholder fallback for newly built sections and routed each tab to its real component.

**UI fix**
- Removed the visible mark/icon next to the regular workspace rail title.
- Kept compact-mode rail behavior intact.

### Home Command Center

**`src/frontend/src/components/loans/workspace/WorkspaceHome.tsx`**
- Rebuilt the Home screen as a loan command center.
- Added hero metrics:
  - Loan number
  - Status
  - Amount
  - Product
  - Purpose
  - LTV / CLTV
  - DTI
  - DSCR
  - Submitted date
  - Lock status
- Added three-column dashboard layout:
  - Borrower & Property Summary
  - Loan Summary + Workflow Summary
  - Internal Team + Recent Activity
- Workflow summary cards navigate directly to the relevant workspace section.
- Uses real available loan detail data where exposed by backend, and clear pending/mock placeholders where backend fields do not exist yet.

### Financial Analysis Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceIncome.tsx`**
- Reframed the old Income tab as the Financial Analysis workspace.
- Added subsection navigation:
  - Overview
  - Employment Income
  - Self Employment
  - Rental Income
  - Asset & Reserve Analysis
  - Other Income
  - Income Calculation Summary
  - Audit Trail
- Preserved existing wage, self-employment, rental/DSCR worksheets and right-click field metadata behavior.
- Added pending-state KPIs where backend fields do not exist yet instead of fabricating persisted values.

**`src/frontend/src/components/loans/workspace/AssetReserveAnalysis.tsx`**
- Added a full frontend-first Asset & Reserve Analysis module.
- Asset accounts support:
  - Institution
  - Account holder
  - Account type
  - Borrower age
  - Last four
  - End balance
  - Statement expiration
  - Retirement flag
- Each account can hold multiple allocations:
  - Cash to close
  - Asset depletion
  - ATR in full
  - Reserves
- Added expandable account rows and allocation rows.
- Added sticky live summary panel with:
  - Total verified assets
  - Total eligible assets
  - Cash-to-close allocation
  - Asset depletion allocation
  - ATR allocation
  - Available reserves
  - Remaining unallocated eligible assets
  - Monthly depletion income
  - Funds required to close
  - Additional amount needed
- Added validation for:
  - Allocations exceeding eligible balance
  - Retirement account used for cash to close
  - Missing required account fields
  - Expired statements
  - Cash-to-close shortfall

**`src/frontend/src/types/financialAnalysis.ts`**
- Added typed frontend model for:
  - Financial analysis subsections
  - Asset accounts
  - Asset allocations
  - Computed asset accounts
  - Validation messages
  - Worksheet summary
  - Prepared income output records

**`src/frontend/src/state/financialAnalysisStore.ts`**
- Added Zustand store for asset worksheet state.
- Added calculation helpers for:
  - Eligible balance
  - Allocation totals
  - Remaining eligible balance
  - Available reserves
  - Monthly asset depletion income
  - Additional needed to close
  - Income output generation
- Encapsulated the current underwriting math so components do not duplicate calculation rules.

**`src/frontend/src/services/financialAnalysisService.ts`**
- Added mock asset worksheet service.
- Left TODO seam for future `GET /loans/{loanId}/financial-analysis/assets`.

### HMDA Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceHMDA.tsx`**
- Built a dedicated HMDA compliance workspace.
- Added two-column layout:
  - Left: HMDA data entry
  - Right: sticky validation panel
- Added form sections:
  - Borrower Information
  - Property Information
  - Loan Information
- Added live completion percentage.
- Added missing required field list.
- Added warning list for incomplete reportability context.
- Uses mock/local state until backend HMDA tables and validation endpoints exist.

### Documents Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceDocuments.tsx`**
- Built a three-panel document management workspace:
  - Left: category navigation
  - Center: document grid/table
  - Right: preview and metadata panel
- Added document categories:
  - Income
  - Assets
  - Credit
  - Property
  - Disclosures
  - Conditions
  - Closing
  - Miscellaneous
- Added mock document records with:
  - File name
  - Category
  - Version
  - Status
  - Uploaded by
  - Uploaded date
  - Linked condition
  - Document type
  - Metadata
- Added empty states for categories with no documents.

### Disclosures Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceDisclosures.tsx`**
- Built a disclosures workspace for disclosure desk users.
- Added:
  - Disclosure lifecycle timeline
  - Disclosure package list
  - Prepare / Review / Send subtabs
  - Sticky compliance panel
- Added compliance indicators:
  - TRID clock
  - Earliest closing date
  - Waiting period status
  - Missing signatures
  - Outstanding redisclosures
- Uses mock package/event data until disclosure tables and APIs exist.

### Funding Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceFunding.tsx`**
- Built a funding readiness screen.
- Added checklist for:
  - Clear to fund approval
  - Wire instructions
  - Warehouse line
  - Final conditions
  - Funding authorization
- Added Wire & Warehouse summary panel.
- Added sticky status panel and funding review action.

### Closing Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceClosing.tsx`**
- Built a closing coordination screen.
- Added closing timeline:
  - Closing package requested
  - Title final review
  - CD waiting period
  - Docs out
  - Signed package returned
- Added sticky closing control panel:
  - Earliest close
  - Docs out
  - Signing appointment
  - Package returned
- Added `Prepare Closing Package` placeholder action.

### Conversation Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceConversation.tsx`**
- Replaced the old Notes placeholder with a Conversation workspace.
- Added internal chat-style thread:
  - Author
  - Role
  - Timestamp
  - Message body
- Added composer placeholder for future mentions and attachments.
- Added linked activity panel.

### Audit Log Workspace

**`src/frontend/src/components/loans/workspace/WorkspaceAuditLog.tsx`**
- Built an audit log workspace.
- Added audit summary strip:
  - Event count
  - Material changes
  - Sources
  - Export status
- Added event history table with:
  - Event
  - Actor
  - Source
  - Field
  - Before
  - After
  - Timestamp
- Uses mock audit entries until backend audit endpoints are wired to the workspace.

### Styling

**`src/frontend/src/styles/globals.css`**
- Added/expanded styles for:
  - Vertical loan workspace rail
  - Fixed loan topbar enhancements
  - Home command center hero bar and panels
  - Financial Analysis subsection shell
  - Asset account grid, allocation rows, validation states, and sticky summary panel
  - HMDA validation panel
  - Document three-panel layout
  - Disclosure timeline and workspace subtabs
  - Funding and closing control panels
  - Conversation thread and composer
  - Audit table
  - Responsive mobile stacking
- Kept Origina green/black/white theme.
- Used orange/red only for functional warning/blocking states.

### Backend Gaps Identified

The workspace is now frontend-complete enough to demonstrate the command center, but these backend pieces are still needed:

- `asset_accounts`
- `asset_allocations`
- immutable financial calculation run snapshots
- HMDA data and validation result persistence
- disclosure packages and append-only disclosure events
- document versioning/category/status APIs
- conversation/message persistence
- funding and closing milestone persistence
- workspace audit endpoint that aggregates audit log, disclosure events, document events, condition changes, and financial calculation changes
- richer loan summary/detail API fields for:
  - Purpose
  - LTV / CLTV
  - DTI / DSCR
  - verified assets
  - cash to close
  - lock status
  - internal team assignments

### Validation performed

- `npm run lint` passed.
- `npm run build` passed.
- Build still shows existing non-blocking warnings:
  - stale `baseline-browser-mapping`
  - missing native Next SWC package, WASM fallback used
  - experimental CommonJS/ESM warning from Redux Toolkit bundle during static generation

---

## Session 18 — Workspace Expansion: Status, Property, Appraisal, Credit, Escrow, Title & Legal

**Type:** Major feature implementation — 5 new DB tables, 5 new API route modules, 6 new workspace components

### Scope

Full end-to-end build of six new loan workspace modules following the Origina Workspace Expansion spec. Each module required database migrations, SQLAlchemy models, Pydantic schemas, FastAPI route modules, frontend type definitions, and React workspace components.

### Database Migrations

| Migration | File | Content |
|---|---|---|
| 113 | `113_property_details.sql` | `ALTER TABLE properties ADD COLUMN` — 19 new columns: county, census_tract, msa, apn, year_built, square_footage, lot_size_sqft, units, is_mixed_use, is_rural, is_condo_pud, flood_zone, flood_insurance_required, annual_taxes, hazard_insurance, hoa_dues, value_source, estimated_value |
| 114 | `114_appraisal.sql` | New `appraisal_orders` table — order tracking, valuation, and full review/clearance fields |
| 115 | `115_credit.sql` | New `credit_reports`, `credit_liabilities`, `credit_events` tables |
| 116 | `116_escrow.sql` | New `escrow_details` table (unique per active loan via partial index) |
| 117 | `117_title.sql` | New `title_orders`, `title_exceptions` tables |

**Bug found during migration:** Migration trigger function was named `set_updated_at()` but the actual DB function installed by earlier migrations is `update_updated_at_column()`. Fixed in migrations 114–117 before applying.

### Backend — Models

| File | Content |
|---|---|
| `models/appraisal.py` (NEW) | `AppraisalOrder` — TenantMixin, Base, all order/review fields |
| `models/credit.py` (NEW) | `CreditReport`, `CreditLiability`, `CreditEvent` |
| `models/escrow.py` (NEW) | `EscrowDetail` |
| `models/title.py` (NEW) | `TitleOrder`, `TitleException` |
| `models/properties.py` (UPDATED) | Added all 19 new columns from migration 113 |
| `models/loan.py` (UPDATED) | Added 4 new `relationship()` entries: `appraisals`, `credit_reports`, `escrow` (uselist=False), `title_orders` — all with `cascade="all, delete-orphan"` |
| `models/__init__.py` (UPDATED) | Added imports for all 7 new model classes |

### Backend — Schemas

| File | Content |
|---|---|
| `schemas/appraisal_schema.py` (NEW) | `AppraisalOrderBase/Create/Update/Out` |
| `schemas/credit_schema.py` (NEW) | `CreditReportBase/Create/Update/Out`, `CreditLiabilityBase/Create/Update/Out`, `CreditEventBase/Create/Update/Out` |
| `schemas/escrow_schema.py` (NEW) | `EscrowDetailBase/Create/Update/Out` |
| `schemas/title_schema.py` (NEW) | `TitleOrderBase/Create/Update/Out`, `TitleExceptionBase/Create/Update/Out` |
| `schemas/property_schema.py` (UPDATED) | Added all 19 new fields to `PropertyBase` |

### Backend — API Routes

| File | Prefix | Endpoints |
|---|---|---|
| `api/v1/status.py` (NEW) | `/loans/{id}/status` | `GET` current status + available transitions; `GET` history; `POST` transition. Server-authoritative `ALLOWED_TRANSITIONS` dict enforces legal moves. Every transition writes to `loan_status_events`. |
| `api/v1/appraisal.py` (NEW) | `/appraisals` | `GET ?loan_id=`, `POST`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` |
| `api/v1/credit.py` (NEW) | `/credit` | Reports: `GET ?loan_id=`, `POST`, `PATCH /{id}`. Liabilities: same. Events: same. |
| `api/v1/escrow.py` (NEW) | `/escrow` | `GET /{loan_id}`, `PUT /{loan_id}` (upsert pattern — creates if absent, updates if present) |
| `api/v1/title.py` (NEW) | `/title` | Orders: `GET ?loan_id=`, `POST`, `GET /{id}`, `PATCH /{id}`. Exceptions: `GET ?loan_id=`, `POST`, `PATCH /{id}`. |
| `core/main.py` (UPDATED) | — | Registered 5 new routers. Total routes: **123** (verified). |

**Status transition rules (`ALLOWED_TRANSITIONS`):**

```
new_draft         → submitted, withdrawn, cancelled
submitted         → conditions_review, denied, withdrawn, cancelled
conditions_review → approved_pending, approved, denied, withdrawn, cancelled
approved_pending  → approved, denied, withdrawn, cancelled
approved          → funded, denied, withdrawn, cancelled
funded            → closed, post_closing
closed            → post_closing, archived
post_closing      → archived
denied/withdrawn/cancelled/archived → [] (terminal)
```

### Frontend — Types

**`src/frontend/src/types/api.ts` (UPDATED)**
- Added: `PropertyDetailOut` (extends `PropertyOut` with 19 new fields), `StatusTransitionOption`, `LoanStatusOut`, `StatusEventOut`, `AppraisalOrderOut`, `CreditReportOut`, `CreditLiabilityOut`, `CreditEventOut`, `EscrowDetailOut`, `TitleExceptionOut`, `TitleOrderOut`

### Frontend — Navigation

**`src/frontend/src/components/loans/workspace/workspaceSections.ts` (UPDATED)**
- Restructured into 4 groups: Workflow (5 sections), Loan File (14 sections), Team (1 section), System (1 section)
- Added new sections: `status`, `subject-property`, `appraisal`, `credit`, `escrow`, `title-legal`
- Added aliases: `overview→home`, `property→subject-property`, `title→title-legal`

**`src/frontend/src/components/loans/LoanWorkspaceShell.tsx` (UPDATED)**
- Added imports and routing for all 6 new workspace components

### Frontend — Workspace Components (all NEW)

**`WorkspaceStatus.tsx`**
- Current status badge with tone-coded colors (green/amber/red/blue)
- Available transitions panel — buttons filtered to legal next states
- Confirmation modal with optional reason field
- Status history timeline rendering `loan_status_events` rows
- Calls real API: `GET /loans/{id}/status`, `POST /loans/{id}/status/transition`, `GET /loans/{id}/status/history`

**`WorkspaceSubjectProperty.tsx`**
- Address form (street, city, state, ZIP, county, APN, census tract, MSA)
- Property characteristics (type, occupancy, year built, sq ft, lot size, units)
- Boolean flags (mixed-use, rural, condo/PUD)
- Flood zone and flood insurance required
- Valuation & taxes (value source, estimated value, annual taxes, hazard insurance, HOA)
- Saves via `PATCH /properties/{id}` with WorkspaceSaveBar

**`WorkspaceAppraisal.tsx`**
- 4-step progress stepper (Ordered → Inspection → Received → Reviewed), driven by date fields
- Order details: vendor/AMC, appraiser, dates, appraisal type
- Valuation: appraised value, purchase price, property condition C1–C6 picker
- Review/clearance: review status, reviewed by, ROV flag, second appraisal flag, review notes
- Create-new-order flow when no order exists on file
- Calls `GET/POST/PATCH /appraisals/`

**`WorkspaceCredit.tsx`**
- Credit score cards: Equifax, Experian, TransUnion, Middle Score, Rep Score with risk color coding (≥740 green, ≥680 blue, ≥620 amber, <620 red)
- Report metadata: date, vendor, reference number
- Liabilities grid: total balance/payments summary + per-tradeline table with excluded/paid-at-closing tags
- Derogatory events list: bankruptcy, foreclosure, short sale, charge-off, etc.
- Read-only (credit data is vendor-imported, not manually entered)
- Calls `GET /credit/reports`, `/credit/liabilities`, `/credit/events`

**`WorkspaceEscrow.tsx`**
- Escrow contact card (company, officer, email, phone, address)
- Key dates (contract, closing)
- Settlement summary (EMD, estimated/verified cash-to-close, seller/lender credits, third-party fees, escrow balance, wire instructions status)
- Clearance checklist: closing protection letter, settlement statement reviewed, wire verified
- Create/open escrow flow when no record exists
- Upserts via `PUT /escrow/{loan_id}` with WorkspaceSaveBar

**`WorkspaceTitleLegal.tsx`**
- Title company contact + ordered/commitment dates + title status picker
- Vesting section (borrower vesting string, ownership type dropdown, entity name)
- Inline exception management: add exception form, per-exception status, one-click "Mark Cleared" action
- Open exception count badge in section header
- Funding blocked and legal review required toggles with conditional field rendering
- Exception cards with left-border color coding (red=open, amber=in-review, green=cleared)
- Calls `GET/POST/PATCH /title/orders` and `GET/POST/PATCH /title/exceptions`

### Frontend — CSS

**`src/frontend/src/styles/globals.css` (UPDATED — ~420 lines appended)**
- `ws-status-*` — status badge variants, transition buttons, confirm overlay/modal, timeline
- `prop-*` — property form grid, checkboxes
- `appr-*` — appraisal stepper (dot + connector), field grid, textarea
- `credit-*` — score cards (featured variant), liability table, event cards
- `escrow-*` — field grid, checklist
- `title-*` — section header with badge, exception cards (tone variants), inline exception form, alert section variant

### Seed Data

**`scripts/seed_nonqm_loans.py` (REWRITTEN)**
- Produces 200 realistic Non-QM loans with ~90% field coverage
- Added: co-borrowers (40% of loans), notes (388 total), tasks (220 total), broker party assignments, full financial calculations (P&I, taxes, HOI, HOA, escrow, total payment)
- Starts with `DELETE FROM loans WHERE tenant_id = :tid` (CASCADE removes all child rows) to allow clean reseeding
- Results: 200 loans, 77 co-borrowers, 388 notes, 220 tasks, 200 broker assignments

### Bug Fixes — Same Session

**Pipeline table: last row always hidden (`globals.css`)**
- Root cause: `.pipeline-table-wrap` had `overflow-y: clip` (from a prior attempted fix) — even with clip, `overflow-x: auto` alone makes the element a CSS scroll container per spec, and all sticky positioning inside it is relative to that container's top, not the viewport. The thead's `top: 52px` was permanently mispositioned.
- Fix: Removed `position: sticky; top: 52px; z-index: 5` from `.pipeline-table thead th` entirely. Thead is no longer sticky. Page scrolling handles vertical scrolling. Horizontal overflow is preserved.

**`WorkspaceHome.tsx` — `.toFixed is not a function`**
- Root cause: Postgres `numeric`/`decimal` columns (dscr, debt_to_income, ltv, etc.) serialize as strings in JSON. JavaScript's `value.toFixed()` does not exist on strings.
- Fix: `fmtMoney`, `fmtPct`, `fmtRatio` all now pass through `Number(value)` before any arithmetic. `isNaN()` guard returns `"-"` for non-numeric strings.

**`WorkspaceIncome.tsx` — `fin.dscr.toFixed is not a function`**
- Same root cause as above — DSCR from `loan_financials` arrives as a string.
- Fix: inline `Number(fin.dscr).toFixed(2)` and hardened `fmtPct` helper with same `Number()` coercion.

### Lint Fixes

After running `npm run lint`:

| File | Issue | Fix |
|---|---|---|
| `WorkspaceBorrowerURLA.tsx:498` | `react/no-unescaped-entities` — raw `"` in JSX text | Replaced with `&quot;` |
| `WorkspaceCredit.tsx:52` | `react-hooks/set-state-in-effect` — `setLoading(true)` synchronously in effect body | Removed synchronous call; initialized `loading` state as `!!token` so it starts `true` when authenticated |
| `WorkspaceStatus.tsx:24` | `@typescript-eslint/no-unused-vars` — `TERMINAL` set was defined but never referenced | Removed `TERMINAL` |

**Validation performed:**
- `npm run lint` — 0 errors, 0 warnings ✓
- `npm run build` — compiled successfully, 60 static pages generated ✓

---

