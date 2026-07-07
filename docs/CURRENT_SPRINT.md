# Current Sprint — Sprint 1: Demo Unblocked

> **Sprint index:** [docs/sprints/README.md](sprints/README.md)
> **Full backlog:** [ROADMAP.md](ROADMAP.md) | **Session log:** [BUILD_HISTORY.md](BUILD_HISTORY.md)
>
> **Update this at the start of every session** — mark the active phase, note the session goal, update status.

---

## Sprint Goal

Put a laptop in front of someone and run a demo without it breaking.

**Sprint is done when:**
- You can log in, browse a paginated pipeline, submit a loan, and open it to see real financial data
- The 5 B-gate test files exist and are green
- CORS is locked and JWT secret comes from the environment

---

## Phases

### Phase 1.1 — Security Config
**Status:** Not started
**Est. effort:** ~30–45 minutes (backend only)

| Task | File(s) | Notes |
|---|---|---|
| Load `JWT_SECRET_KEY` from environment variable | `src/backend/app/core/config.py` | Add `os.environ` read; assert it is not the hardcoded default at startup |
| Lock CORS to `http://localhost:3000` in dev | `src/backend/app/core/main.py` | `allow_origins=["http://localhost:3000"]`; make it env-configurable for prod |
| Create `.env.example` at repo root | `.env.example` | Document `JWT_SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS` |
| Write `tests/backend/test_auth_secret_from_env.py` | `tests/backend/` | Token signed with env key; default key rejected at startup; changing key invalidates old tokens |

**Phase done when:** Backend refuses to start with the hardcoded default secret. CORS blocks requests from origins other than localhost:3000.

---

### Phase 1.2 — Pagination
**Status:** Not started
**Est. effort:** ~1 session (backend + frontend)

| Task | File(s) | Notes |
|---|---|---|
| Add `skip`/`limit` params to all list endpoints | `api/v1/loans.py`, `conditions.py`, `documents.py`, `borrowers.py`, `exceptions.py`, `tasks.py`, `notes.py` | Return `{"items": [...], "total": n}` envelope |
| Update `types/api.ts` with paginated envelope type | `src/frontend/src/types/api.ts` | `PaginatedResponse<T> = { items: T[]; total: number }` |
| Add page controls to `PipelineGrid.tsx` | `src/frontend/src/components/loans/pipeline/PipelineGrid.tsx` | Page 1/2/3 buttons or prev/next; reset to page 1 on filter/sort change |
| Update `loanService.ts` to pass `skip`/`limit` | `src/frontend/src/services/loanService.ts` | Calculate `skip = (page - 1) * limit` |
| Write `tests/backend/test_pagination_envelope.py` | `tests/backend/` | Envelope shape correct; `skip`/`limit` honored; `total` matches DB count |

**Phase done when:** Pipeline shows 50 loans per page with controls. Direct `GET /api/v1/loans?skip=50&limit=50` returns page 2.

---

### Phase 1.3 — Loan Submission Integrity
**Status:** Not started
**Est. effort:** ~1 session (backend + frontend verification)

**Open questions to answer before coding:**
- Does `submit_loan` in `loans.py` atomically insert `loans` + `loan_financials` + `loan_terms` in one transaction? Verify first.
- Does `saveDraft` in `submissionStore.ts` create the borrower and property records, or only the loan header? (Fixed in Session 20 but worth re-verifying end-to-end.)

| Task | File(s) | Notes |
|---|---|---|
| Audit `submit_loan` endpoint | `src/backend/app/api/v1/loans.py` | Confirm or fix 3-table atomic insert |
| Verify `saveDraft` creates borrower + property | `src/frontend/src/services/submissionService.ts` | Trace the full save path; `borrowerDbIds` tracking must prevent duplicates |
| Fix `LoanSubmitOut` response shape if needed | `src/backend/app/schemas/loan_schema.py` | Must return `borrower_name` and `loan_amount` (JOINed from satellite tables) |
| Manual end-to-end test | — | Submit a loan via wizard → confirm borrower name and amount appear in pipeline grid |
| Write `tests/backend/test_loan_submission_e2e.py` | `tests/backend/` | Happy path (3 rows exist); tenant scoping (loan A invisible to tenant B); rollback (invalid payload leaves no partial rows) |

**Phase done when:** Submitting a loan via the wizard creates all three DB rows atomically. The submitted loan appears in the pipeline with the correct borrower name and loan amount.

---

### Phase 1.4 — WorkspaceHome Real Data + B-Gate Tests
**Status:** Not started
**Est. effort:** ~1 session (frontend + tests)

| Task | File(s) | Notes |
|---|---|---|
| Wire `GET /loans/{id}/financials` into `WorkspaceHome` | `src/frontend/src/components/loans/workspace/WorkspaceHome.tsx` | Show loan amount, LTV, FICO, DSCR |
| Wire `GET /loans/{id}/terms` into `WorkspaceHome` | Same file | Show interest rate, term months, rate type, lock days |
| Add `useQuery` hooks for financials + terms | `src/frontend/src/hooks/` | `useLoanFinancials(loanId)`, `useLoanTerms(loanId)` |
| Write `tests/backend/test_loan_financials_endpoint.py` | `tests/backend/` | Returns rate, term, amount fields; 404 on unknown loan; tenant scoped |
| Write `tests/frontend/WorkspaceHome.test.tsx` | `tests/frontend/` | Renders financial summary block without crash given a real loan payload |
| Confirm all B-gate tests pass | — | Run `./scripts/run_tests.sh` — all 5 test files green |

**Phase done when:** Opening any loan in the workspace shows real rate, term, and financial data. `./scripts/run_tests.sh` exits 0 with all B-gate tests passing.

---

## Sprint Status Tracker

| Phase | Status | Session |
|---|---|---|
| 1.1 — Security Config | Not started | — |
| 1.2 — Pagination | Not started | — |
| 1.3 — Loan Submission Integrity | Not started | — |
| 1.4 — WorkspaceHome Real Data + Tests | Not started | — |

---

## B-Gate Tests Checklist

These must all be green before the sprint closes:

- [ ] `tests/backend/test_auth_secret_from_env.py`
- [ ] `tests/backend/test_cors.py`
- [ ] `tests/backend/test_pagination_envelope.py`
- [ ] `tests/backend/test_loan_submission_e2e.py`
- [ ] `tests/backend/test_loan_financials_endpoint.py`
- [ ] `tests/frontend/WorkspaceHome.test.tsx`

---

## After This Sprint Completes

1. Write a completion summary below (what shipped, what slipped, lessons learned)
2. Copy this file → `docs/sprints/sprint-1-demo-unblocked.md`
3. Update `docs/sprints/README.md` — mark Sprint 1 complete, add archive link and completion date
4. Move all Sprint 1 ROADMAP items to "What We Did Well" in `ROADMAP.md`
5. Write a new `CURRENT_SPRINT.md` for Sprint 2 — Core Workflow

---

## Completion Summary
*(Fill in when sprint closes)*

**Completed:** —
**Slipped to Sprint 2:** —
**Lessons learned:** —
