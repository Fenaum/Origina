# Origina LOS — Project Roadmap

> **Cross-links:** [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md) | [BUILD_HISTORY.md](BUILD_HISTORY.md)

## Current State (as of June 2026)

The platform has a working end-to-end demo path:
1. Borrower visits `/borrower/welcome` → completes intake → sees program recommendations → submits handoff
2. AE logs in at `/login` → sees pipeline of 202 real seeded loans → opens any loan file → browses workspace sections
3. AE views analytics at `/analytics` → KPIs, charts, volume trends
4. AE manages exceptions at `/exceptions` → creates pre-file exceptions → attaches approved exceptions to loans

**What is real:** Auth, pipeline API, 202 seeded Non-QM loans, borrower intake (DB), analytics from live data, full exception module (25 routes), controlled values architecture (18 sets, 144 values), metadata API.
**What is mock:** Loan submission wizard not wired to API (drafts in localStorage), document upload (simulated), pricing (hardcoded scenarios), MISMO parsing (stub).

---

## What We Did Well ✅

### Backend
- [x] Clean layered architecture — no business logic leaking into routes
- [x] Audited DB writes via `get_audited_db` dependency — every mutation is traceable
- [x] LATERAL JOIN pipeline query — no N+1, performant at scale
- [x] Raw SQL migrations with schema tracking — no Alembic conflicts
- [x] Satellite table pattern (`loan_financials`, `loan_terms`) — clean separation, 1:1 enforced at DB level
- [x] Event sourcing for loan status — full audit trail, compliant
- [x] Multi-tenancy baked in at query level — not bolted on
- [x] 202 realistic seeded Non-QM loans across 5 programs with realistic distributions
- [x] Anonymous intake sessions — no auth wall before borrower engagement
- [x] RBAC dependency factory — one line per route to enforce roles
- [x] Exception module (25 routes) — full lifecycle, structured UW fields, authority rules, decisions with conditions
- [x] Controlled values architecture — zero PostgreSQL ENUMs, TEXT+CHECK, 18 value sets, tenant override model
- [x] Metadata API (`GET /api/v1/metadata/values`) — frontend bootstrap endpoint for all controlled values
- [x] Pre-file exceptions — `loan_id` nullable, global `/exceptions` page, `link-loan` endpoint

### Frontend
- [x] Modular component architecture — each workspace section is independent
- [x] Zustand stores cleanly separated by concern (auth, pipeline, intake, recent loans, submission)
- [x] SSN security invariant enforced in code via `partialize` — can't accidentally persist it
- [x] Client-side filter/sort pipeline — instant feedback, zero round-trips
- [x] Built-in vs user-created views separation — code updates don't wipe user preferences
- [x] All state that should be ephemeral uses sessionStorage (intake) vs persistent (pipeline prefs)
- [x] Horizontal workspace navigation with `?section=` params — no 15-page route explosion
- [x] Accessibility baked in from the start (aria-*, focus-visible, heading hierarchy, role=menu)
- [x] CSS design system via variables — consistent colors, radii, spacing throughout
- [x] `:has()` selector for layout overrides — pipeline workspace goes full-bleed without a new layout component

---

## Priority 1 — Demo-Blocking (must be done before first real demo)

### Backend
- [ ] **Pagination** — all list endpoints return unbounded results
  - Add `skip: int = 0, limit: int = 50` to all list routes
  - Return `{"items": [...], "total": n}` envelope
  - Update `types/api.ts` to match
  - _Reason: 202 loans is fine now, but 2,000 will break the browser_

- [ ] **CORS lockdown** — currently `allow_origins=["*"]`
  - Lock to `http://localhost:3000` in dev, real domain in prod
  - _Reason: security requirement before any external access_

- [ ] **JWT secret rotation**
  - Replace dev default `JWT_SECRET_KEY` in `core/config.py`
  - Load from environment variable, not hardcoded
  - _Reason: demo instances must not share the dev secret_

### Frontend
- [ ] **Loan submission to real API**
  - `submissionService.ts` currently stores drafts in localStorage only
  - Wire `POST /api/v1/loans/` to create loan + `loan_financials` + `loan_terms` atomically
  - _Reason: a borrower completes intake, gets a program match, but their loan never enters the pipeline_

- [ ] **Real loan_financials + loan_terms in WorkspaceHome**
  - Current workspace home shows only `LoanSummary` fields (no financial details)
  - Need `GET /api/v1/loans/{id}/financials` and terms
  - _Reason: loan file is incomplete without amounts and rate terms_

---

## Priority 2 — Core Workflow (within 4 weeks of demo)

### Backend
- [ ] **Real user creation** — only `admin@origina.dev` works today
  - API endpoint: `POST /api/v1/users/` (admin only)
  - Create broker, underwriter, processor users
  - Assign `tenant_id` correctly

- [ ] **Role field on user model** — currently derived from email prefix
  - Store role in DB, not inferred from email string
  - Fix `get_current_user` to read from `users.role` column

- [ ] **Condition management endpoints** — routes exist but need full CRUD + lifecycle
  - `PATCH /conditions/{id}/clear`
  - `PATCH /conditions/{id}/waive` (with reason)
  - `PATCH /conditions/{id}/reject` (with reason)

### Frontend
- [ ] **Conditions section in Loan Workspace** — currently a placeholder
  - List of conditions with status badges
  - Clear / Waive / Reject actions
  - Add new condition form

- [ ] **Pagination in pipeline grid** — wire `skip`/`limit` to backend
  - Add page controls or infinite scroll to `PipelineGrid`
  - Update `loanService.ts` to pass pagination params

- [ ] **Real users for demo walkthroughs**
  - Create broker user, underwriter user via admin panel or script
  - Verify role-based sidebar and pipeline access for each

---

## Priority 3 — Full Feature Completeness (milestone after initial demo)

### Backend
- [ ] Borrower-facing condition view endpoint
- [ ] Document storage (S3 integration — currently simulated)
- [ ] Notification system (email on handoff, status change)
- [ ] Loan status transition validation (enforce state machine)
- [x] Exception module — 25 routes, full lifecycle, decisions, conditions, pre-file
- [x] Task management endpoints — full CRUD + status transitions
- [ ] Notes/internal conversation endpoint
- [ ] Full URLA (1003) data model and API

### Frontend
- [ ] Processing section — milestone checklist
- [ ] Underwriting section — decision panel, exception tracking
- [ ] Documents section — upload, categorize, link to conditions
- [ ] Notes section — threaded internal conversation
- [ ] Audit Log section — real `audit_log` table data
- [ ] Loan creation form (`/loans/new/manual`) — multi-step, currently placeholder
- [ ] Status transition UI in workspace topbar
- [ ] Borrower panel in workspace home (co-borrowers, contact info)
- [ ] Property panel (address, type, appraised value)
- [ ] Analytics: date range filter
- [ ] Analytics: export to PDF/image
- [ ] Pipeline: assignment columns (requires backend `LoanSummary` to include AE/processor/underwriter names)
- [ ] Pipeline: priority field (requires DB column + API field)
- [ ] Pipeline: bulk actions (select multiple rows)
- [ ] Right-side activity panel in pipeline (recent loan updates, status changes)
- [ ] React Query / SWR for data caching and background refetch

---

## Priority 4 — Manager & Reporting Layer (post-MVP)

- [ ] Manager analytics dashboard (team KPIs, workload distribution charts)
- [ ] Performance reporting (processing time, approval rates by product)
- [ ] Team KPI pivot tables
- [ ] Pipeline forecasting
- [ ] Funnel conversion rates (submitted → approved → funded)
- [ ] Custom user dashboards
- [ ] Real-time notifications (WebSocket or SSE)

---

## Technical Debt Tracker

| Item | Impact | Effort | Notes |
|---|---|---|---|
| Pagination on list endpoints | High — breaks at scale | Low | `skip`/`limit` params + total count |
| JWT in localStorage → httpOnly cookie | High — security | Medium | Requires server-side session handling |
| `allow_origins=["*"]` | High — security | Low | Config change only |
| JWT secret in code | High — security | Low | Environment variable |
| ~~`loans.status` as `text` vs enum~~ | ~~Medium~~ | ~~Low~~ | ✅ Done — migrations 122–125, zero ENUMs remain |
| No React Query / SWR | Medium — UX | Medium | Add before live API for caching |
| `submissionStore.ts` not wired to API | Medium | Medium | Core demo flow |
| `@shadcn/ui` package is a dummy v0.0.4 | Low | Low | Run `npx shadcn@latest init` when ready for UI primitives |
| bcrypt 4.0.1 pinned | Low | Low | passlib incompatible with bcrypt 4.1+ |
| `_legacy/` pages in routing | Low | Low | Not routed, reference only |

---

## Projection

### To reach demo-ready (first external walkthrough)
**Estimated:** 2–3 weeks
- Loan submission wired to API
- Pagination added
- CORS + JWT secret secured
- At least 2 real user accounts (AE, broker)
- WorkspaceHome shows real loan details

### To reach MVP (internal team use)
**Estimated:** 6–8 weeks after demo-ready
- Conditions management UI complete
- Documents upload (S3 or mock with real file tracking)
- Notes / internal conversation
- Status transition UI
- Real user onboarding

### To reach production
**Estimated:** 3–4 months after MVP
- Full security hardening (httpOnly cookies, rate limiting, HTTPS)
- Full test coverage (backend pytest suite, frontend component tests)
- Real pricing engine integration
- Notification system
- Admin panel
- Multi-tenant onboarding flow

---

## Demo Script (current capabilities)

**Borrower flow:**
1. Visit `http://localhost:3000/borrower/welcome`
2. Click "Get Started" → answer 7 questions (property type, occupancy, purpose, amount, credit, income, employment)
3. See ranked program cards with match scores and rate ranges
4. Click "Connect with a Specialist" → submit email
5. Handoff lead is stored in `intake_handoffs` table

**Ops flow:**
1. Visit `http://localhost:3000/login`
2. Login: `admin@origina.dev` / `TestPass123!`
3. Land on Account Executive dashboard
4. Click "Loan Pipeline" → see 202 real Non-QM loans
5. Use search, filters, sorting, saved views — all instant
6. Click any loan number → enter loan workspace
7. Navigate sections (Home, Processing, Underwriting, Conditions, etc.)
8. Click "Analytics" in sidebar → see all charts and KPIs

**Start commands:**
```bash
# Terminal 1
docker-compose up -d

# Terminal 2
cd src/backend && python3 -m uvicorn app.core.main:app --reload

# Terminal 3
cd src/frontend && npm run dev
```

---

## Documentation Maintenance Rules

- **Update "Current State"** at the start of every major feature session.
- **Move items from Priority lists to "What We Did Well"** when completed — keep the history of what was built and why it mattered.
- **Update the Technical Debt Tracker** when items are resolved (mark ✅) or when new debt is incurred.
- **Update Projection timelines** after major milestones — stale estimates mislead planning.
- Architecture decisions that justify roadmap choices belong in [DECISIONS.md](DECISIONS.md).
