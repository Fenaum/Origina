# Origina LOS — Product Requirements

**Product:** Origina — Non-QM Loan Origination System (LOS) and Third Party Origination (TPO) Platform
**Channel:** Wholesale
**Target Users:** Loan Officers, Processors, Underwriters, Account Executives (AE), Account Managers (AM), Managers, Admins, Brokers, Borrowers
**Product Focus:** Non-QM products only — DSCR, Bank Statement, Asset Depletion, Interest Only, Jumbo Non-QM
**Explicitly Out of Scope:** AI/ML features, pricing engine, MISMO parsing, S3 document storage (reserved for later milestones)

---

## Module 1 — Authentication & Access Control

### Requirements
- [x] Login page with email + password
- [x] JWT-based authentication (OAuth2 password flow)
- [x] Token stored in localStorage, hydrated via `/auth/me` on mount
- [x] Role-based access control (RBAC) on all backend routes
- [x] Role-based sidebar and page guards on frontend
- [x] `ProtectedRoute` component wraps all authenticated pages
- [x] Five defined roles: `loan_officer`, `loan_processor`, `underwriter`, `account_manager`, `it_admin`
- [x] Bootstrap admin user script (`scripts/bootstrap_user.py`)
- [ ] Real user creation UI (admin panel)
- [ ] Role assignment UI
- [ ] Password reset flow
- [ ] Multi-user onboarding (only `admin@origina.dev` works today)
- [ ] httpOnly cookie auth (currently localStorage — acceptable for demo, must change before prod)
- [ ] JWT secret rotation from dev default
- [ ] CORS locked to real domain (currently `allow_origins=["*"]`)

---

## Module 2 — Borrower Welcome & Intake

### Requirements
- [x] Animated welcome page with headline + CTA (`/borrower/welcome`)
- [x] Animated content staging: nav at 900ms, support content at 1100ms, CTA at 1550ms
- [x] `prefers-reduced-motion` support throughout intake
- [x] Anonymous intake sessions (no login required)
- [x] Branching question flow with back navigation
- [x] Question types: property type, occupancy, loan purpose, loan amount, credit score, income type, employment status
- [x] Back button on Q1 routes to welcome page
- [x] Correct DOM heading hierarchy (h1 in question card, no competing h2 in aside)
- [x] `:focus-visible` rings on all interactive elements (accessibility)
- [x] `aria-current="step"` on progress steps
- [x] Live dollar amount preview on loan amount question (no "$0" flash)
- [x] Program ranking page with program cards (`/borrower/results`)
- [x] Rank badges: "Match 1", "Match 2", "Near Miss" (not "#1", "#2")
- [x] Rate range displayed as illustrative-only with per-card disclaimer
- [x] `aria-live="polite"` on loading skeleton
- [x] Handoff page with email capture
- [x] Intake answers persisted to sessionStorage (wiped on tab close — privacy)
- [x] SSN **never** written to localStorage (security invariant)
- [x] Backend anonymous intake sessions (`intake_sessions`, `intake_answers`, `intake_handoffs` tables)
- [x] Backend program ranking endpoint (`POST /api/v1/intake/rank`)
- [x] Client-side fallback ranking if API unavailable
- [ ] Email notification to broker/AE on handoff
- [ ] Real rate ranges from pricing engine (currently illustrative only)
- [ ] Save/resume intake session across browser sessions
- [ ] Co-borrower intake flow

---

## Module 3 — Loan Pipeline Workspace

### Requirements
- [x] Full-bleed pipeline workspace layout (overrides `page-content` padding via `:has()`)
- [x] Sticky toolbar that stays visible while scrolling
- [x] Instant global search (borrower name, loan number, file owner, state — case-insensitive, partial match)
- [x] Search clear button
- [x] Filtered result count badge ("42 of 202 loans")
- [x] + New Loan button in toolbar
- [x] Saved Views dropdown (5 built-in: All Active, Conditions Review, Action Needed, Approved, High Volume)
- [x] User-created saved views (save current filter/sort/column state, stored in localStorage)
- [x] Delete user-created views
- [x] Views persist across sessions
- [x] Filters button with active indicator dot (orange when filters applied)
- [x] Columns button with per-column show/hide checkboxes
- [x] Column reorder via up/down buttons in Columns panel
- [x] Reset to default columns
- [x] Column preferences persist across sessions
- [x] CSV export of currently filtered + sorted loans
- [x] Refresh button
- [x] 5 clickable KPI cards (Active Loans, Conditions Outstanding, Action Needed, Submitted This Month, Approved)
- [x] KPI card click instantly filters the grid
- [x] KPI active state (underline accent on active card)
- [x] Colored KPI variants (warning = orange, success = green)
- [x] Sortable column headers (click to toggle asc/desc, sort indicator arrow)
- [x] Default sort: Last Updated descending
- [x] 13 available columns (Loan Number, Borrower, Status, Product, Amount, Channel, State, File Owner, Conditions, Actions, Submitted, Last Updated, Days Active)
- [x] Color-coded status pills (green = approved/funded, orange = conditions/pending, red = denied/cancelled)
- [x] Color-coded conditions/actions badges (green = clear, orange = outstanding)
- [x] Left orange border on rows with actions needed
- [x] Per-row "···" action menu (Open Loan, View Conditions, Add Note, Copy Loan #)
- [x] Row click navigates to loan workspace
- [x] Slide-over filter panel (right side, transparent backdrop for click-outside dismiss)
- [x] Filter by loan status (multi-select, 10 statuses)
- [x] Filter by product type (multi-select, 7 programs)
- [x] Filter by loan amount range (min/max)
- [x] Filter: Action Needed toggle
- [x] Filter: Conditions Outstanding toggle
- [x] Clear all filters button
- [x] Grid footer row count
- [x] Empty state with "Clear filters" button when no results
- [x] All pipeline state (sort, columns, user views) persisted via `origina.pipeline.v1` in localStorage
- [ ] Pagination (currently loads all loans in one request — needs `skip`/`limit` before scaling)
- [ ] Filter by assigned AE / Processor / Underwriter (fields not yet in `LoanSummary`)
- [ ] Filter by submission date range
- [ ] Filter by closing/funding date
- [ ] Priority field on loans
- [ ] Milestone field on loans
- [ ] Broker company column (not in current API response)
- [ ] Inline row editing (status change, assignment)
- [ ] Multi-select rows for bulk actions
- [ ] Right-side activity panel (recent updates, notes, status changes)
- [ ] Column drag-to-reorder (currently up/down buttons only)
- [ ] Column resize

---

## Module 4 — Loan File Workspace

### Requirements
- [x] `LoanWorkspaceLayout` — sidebar + no TopHeader (cleaner than AppLayout for files)
- [x] Sticky combined topbar: breadcrumb (← Pipeline), borrower name, loan number, status pill, amount, program, state
- [x] Horizontal section navigation tabs
- [x] "More" dropdown for less-used sections (grouped by category)
- [x] Click-outside to close More dropdown
- [x] `?section=xxx` query param routing (shallow push, no full reload)
- [x] Active section tab indicator (bottom border)
- [x] More button shows current active section label when a More section is active
- [x] Section chevron (▴/▾) reacts to dropdown state
- [x] 6 primary sections: Home, Processing, Underwriting, Conditions, Documents, Notes
- [x] 7 More sections: Borrower URLA, Lender URLA, HMDA, Loan Estimate/Closing, Closing, Funding, Audit Log
- [x] WorkspaceHome panel: Loan Summary (8 fields) + Open Items (conditions open/submitted, documents placeholder)
- [x] WorkspaceHome registers loan in Recent Files (Zustand + localStorage, last 5)
- [x] Recent Files in sidebar (borrower name + loan number, highlights active)
- [x] Invalid/unknown section defaults to "home"
- [x] `aria-sort` on sortable table headers
- [x] `role="menu"` / `role="menuitem"` on dropdown items
- [x] Placeholder sections for all 13 non-home sections with descriptive copy
- [ ] Conditions section — real condition management UI (list, clear, waive, reject)
- [ ] Processing section — checklist, milestones
- [ ] Underwriting section — decision panel, exception tracking
- [ ] Documents section — upload, categorize, link to conditions
- [ ] Notes section — internal conversation / threaded notes
- [ ] Borrower URLA — form 1003 display
- [ ] Audit Log — real audit_log table data
- [ ] Real loan_financials and loan_terms data in WorkspaceHome
- [ ] Borrower panel (co-borrowers, contact info)
- [ ] Property panel (address, type, value)
- [ ] Status transition UI (change status with confirmation)

---

## Module 5 — Analytics

### Requirements
- [x] Dedicated `/analytics` route in sidebar below Loan Pipeline
- [x] Same role access as pipeline (AE, broker, underwriter)
- [x] Pipeline KPI grid (5 metrics: Total Active, Pipeline Volume, Average Amount, Loans Needing Action, Submitted This Month)
- [x] Status count bar chart (loans by status)
- [x] Status amount bar chart (dollar volume by status)
- [x] Channel count pie chart
- [x] Action needed breakdown chart
- [x] Monthly submission trend chart (bar chart by month)
- [x] Refresh button
- [x] Loading and error states
- [ ] Date range filter on all charts
- [ ] Role-specific analytics views (e.g., underwriter sees their queue metrics)
- [ ] Export charts as image/PDF
- [ ] Manager analytics dashboard (team KPIs, workload distribution)
- [ ] Pipeline forecasting
- [ ] Funnel conversion rates (submitted → approved → funded)

---

## Module 6 — Loan Submission

### Requirements
- [x] Multi-step borrower application flow (`/borrower/application/[step]`)
- [x] Application state in Zustand with localStorage persistence
- [x] SSN cleared on hydration, never persisted to localStorage
- [ ] Wire submission to real API (`POST /api/v1/loans/`)
- [ ] Loan creation: insert into `loans`, `loan_financials`, `loan_terms` atomically
- [ ] Draft save (resume from last step)
- [ ] Broker-facing new loan form (`/loans/new`)
- [ ] Import from MISMO XML (out of scope — placeholder page exists)
- [ ] Manual entry form (`/loans/new/manual` — placeholder page exists)
- [ ] Document upload during submission
- [ ] Assignment of AE/processor on submission

---

## Module 7 — Condition Management

### Requirements
- [x] Backend: conditions CRUD endpoints exist
- [x] Backend: condition lifecycle (open → submitted → cleared/waived/rejected)
- [x] Conditions count surfaced in pipeline grid and loan workspace home
- [ ] Conditions list UI in loan workspace
- [ ] Clear condition action
- [ ] Waive condition action (with reason)
- [ ] Reject condition (with reason)
- [ ] Add new condition
- [ ] Condition due dates
- [ ] Borrower-facing condition view
- [ ] Document linking to conditions

---

## Module 8 — Document Management

### Requirements
- [x] Document table schema (`documents` table with audit triggers)
- [x] Document upload simulated in submission flow (setTimeout mock)
- [ ] Real S3 upload (out of scope until core loan flow works)
- [ ] Document categorization
- [ ] Document linking to conditions
- [ ] Document viewer in workspace
- [ ] Version control (re-upload replaces previous version)

---

## Module 9 — Admin / Settings

### Requirements
- [ ] User management (create, deactivate, assign roles)
- [ ] Tenant configuration
- [ ] Product configuration (enable/disable programs)
- [ ] Fee templates
- [ ] Notification settings
- [ ] Audit log viewer

---

## Non-Functional Requirements

### Security
- [x] JWT authentication on all protected endpoints
- [x] RBAC enforced at route level (`require_roles()` dependency)
- [x] `tenant_id` never accepted from request body (always from JWT)
- [x] SSN never persisted to localStorage
- [x] Audit log triggers on all major tables (loans, borrowers, conditions, documents)
- [ ] CORS locked to real domain (currently `allow_origins=["*"]`)
- [ ] JWT secret rotated from dev default
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS enforcement (not applicable in dev)

### Performance
- [x] LATERAL JOIN on pipeline query (no N+1)
- [x] Client-side filter/sort on pipeline (202 loans — manageable without pagination)
- [ ] Pagination on all list endpoints (`skip`/`limit` + `total`)
- [ ] React Query / SWR for server state caching
- [ ] Indexed queries (partial indexes exist on `loans`, `conditions`)

### Reliability
- [x] Error states on all data-fetching pages
- [x] Loading states and skeletons
- [x] Retry buttons on fetch errors
- [ ] Optimistic UI updates
- [ ] Offline detection

### Accessibility
- [x] `aria-label` on all navigation landmarks
- [x] `aria-current="step"` on intake progress
- [x] `aria-live="polite"` on async content updates
- [x] `aria-sort` on sortable table headers
- [x] `role="menu"` / `role="menuitem"` on all dropdown menus
- [x] `:focus-visible` rings on interactive elements
- [x] Semantic heading hierarchy enforced
- [ ] Full keyboard navigation audit
- [ ] Screen reader testing
- [ ] Color contrast audit (WCAG AA)
