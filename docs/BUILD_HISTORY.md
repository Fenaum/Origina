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
