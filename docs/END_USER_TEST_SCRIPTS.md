# Origina End-User Test Scripts - Sprints 1-5

> **Related docs:** [PMO.md](PMO.md) | [ROADMAP.md](ROADMAP.md) | [TESTING.md](TESTING.md) | [Sprint Index](sprints/README.md)

These scripts are for business/end-user validation. They are intentionally different from the automated pytest/Vitest suites: a tester should be able to sit at the browser, follow the steps, and record whether the workflow behaves like a real LOS/TPO system.

Use these scripts during sprint demos, UAT reviews, and pilot-readiness checks.

## Test Run Setup

### Environment

| Item | Value |
|---|---|
| Frontend URL | `http://localhost:3000` |
| Backend API docs | `http://localhost:8000/docs` |
| Database | Local PostgreSQL via `docker-compose up -d` |
| Seed data | `python3 scripts/seed_nonqm_loans.py` |
| Seed users | `python3 scripts/seed_roles_and_users.py` once Sprint 2 is complete |

### Core Test Accounts

Before Sprint 2, only the admin account may exist.

| Role | Email | Password | Available after |
|---|---|---|---|
| Admin / IT Admin | `admin@origina.dev` | `TestPass123!` | Sprint 1 |
| Loan Officer | `lo@origina.dev` | `TestPass123!` | Sprint 2 |
| Processor | `processor@origina.dev` | `TestPass123!` | Sprint 2 |
| Underwriter | `uw@origina.dev` | `TestPass123!` | Sprint 2 |
| Account Manager | `am@origina.dev` | `TestPass123!` | Sprint 2 |

### Result Format

For every script, record:

| Field | Value |
|---|---|
| Tester |  |
| Date |  |
| Browser |  |
| Test account |  |
| Result | Pass / Fail / Blocked |
| Defect link or notes |  |

## Sprint 1 - Demo Unblocked

**Sprint goal:** A user can log in, browse a paginated pipeline, submit a loan, and open it to see real financial data.

### S1.1 - Login and Dashboard Access

| Field | Value |
|---|---|
| Tester role | Admin / Account Executive demo user |
| Prerequisite | Backend, frontend, and seeded database are running |
| Test data | `admin@origina.dev` / `TestPass123!` |

Steps:
1. Go to `http://localhost:3000/login`.
2. Enter `admin@origina.dev`.
3. Enter `TestPass123!`.
4. Submit the login form.
5. Confirm that the dashboard loads.
6. Confirm the sidebar shows expected operational navigation, including Loan Pipeline.

Expected result:
- Login succeeds without console-visible or page-visible errors.
- User lands on the dashboard.
- Sidebar navigation is visible and usable.

### S1.2 - Pipeline Pagination

| Field | Value |
|---|---|
| Tester role | Admin / Loan Officer |
| Prerequisite | At least 202 seeded Non-QM loans |
| Test data | Pipeline seeded by `scripts/seed_nonqm_loans.py` |

Steps:
1. Log in.
2. Open Loan Pipeline from the sidebar.
3. Confirm the first page shows no more than 50 loans.
4. Click Next.
5. Confirm the page number or range changes.
6. Confirm the loans shown are different from page 1.
7. Click Previous.
8. Confirm the first page returns.

Expected result:
- Pipeline is paginated at 50 loans per page.
- Total loan count is visible or implied by page controls.
- Next and Previous controls work without reloading the whole application.
- No duplicate loans appear between page 1 and page 2.

### S1.3 - Search, Filter, Sort, and Open a Loan

| Field | Value |
|---|---|
| Tester role | Admin / Loan Officer |
| Prerequisite | Pipeline page loaded |
| Test data | Any visible loan |

Steps:
1. Enter part of a borrower name or loan number in the search box.
2. Confirm the table narrows to matching results.
3. Clear the search.
4. Apply a status or product filter.
5. Confirm the result count changes.
6. Sort by a visible sortable column.
7. Click a loan row or loan number.

Expected result:
- Search and filters update the grid.
- Sort order visibly changes.
- Opening a loan navigates to the loan workspace.

### S1.4 - Workspace Home Shows Real Financials

| Field | Value |
|---|---|
| Tester role | Admin / Loan Officer |
| Prerequisite | Loan workspace opened from pipeline |
| Test data | Any seeded loan with financials |

Steps:
1. Open a loan from the pipeline.
2. Stay on the Home section.
3. Review the hero metrics and loan summary fields.
4. Confirm LTV, CLTV, DTI, DSCR, FICO, interest rate, and lock status are present when available.
5. Refresh the page.
6. Confirm the same financial data reloads.

Expected result:
- Workspace Home is not a placeholder.
- Financial metrics are populated from the API.
- Refreshing the page preserves the displayed loan data.

### S1.5 - New Loan Submission Appears in Pipeline

| Field | Value |
|---|---|
| Tester role | Admin / Loan Officer |
| Prerequisite | Loan creation/submission wizard available |
| Test data | Create a unique borrower name, e.g. `Sprint One Test Borrower <date>` |

Steps:
1. Open Loan Pipeline.
2. Click New Loan.
3. Complete the required loan setup, borrower, property, financial, and terms fields.
4. Submit the loan.
5. Return to the pipeline.
6. Search for the unique borrower name.
7. Open the loan.

Expected result:
- Submission succeeds without partial-save errors.
- Loan appears in the pipeline with the correct borrower name and amount.
- Opening the loan shows matching loan financials and terms.

## Sprint 2 - Core Workflow

**Sprint goal:** Multiple real users with different roles can use the platform, and the underwriter can manage conditions through an enforced lifecycle.

### S2.1 - Seeded Users Can Log In by Role

| Field | Value |
|---|---|
| Tester role | Admin validates all roles |
| Prerequisite | Sprint 2 seed users created |
| Test data | Accounts listed in Core Test Accounts |

Steps:
1. Log out of the current account.
2. Log in as `lo@origina.dev`.
3. Confirm the dashboard and sidebar match a loan officer workflow.
4. Log out.
5. Repeat for `processor@origina.dev`, `uw@origina.dev`, and `am@origina.dev`.

Expected result:
- Each user can log in.
- Sidebar and protected pages reflect the user's backend role.
- Users do not see admin-only functions unless they are `it_admin`.

### S2.2 - Admin Creates a New User and Assigns a Role

| Field | Value |
|---|---|
| Tester role | IT Admin |
| Prerequisite | Admin user logged in |
| Test data | New email such as `uat-lo-<date>@origina.dev` |

Steps:
1. Log in as `admin@origina.dev`.
2. Open the admin or user management page.
3. Create a new active user with name, email, and password.
4. Assign the `loan_officer` role.
5. Log out.
6. Log in as the new user.

Expected result:
- Admin can create the user.
- The new user is assigned to the current tenant automatically.
- The new user can log in and sees loan officer navigation.

### S2.3 - Non-Admin Cannot Create Users

| Field | Value |
|---|---|
| Tester role | Loan Officer |
| Prerequisite | Loan officer account exists |
| Test data | `lo@origina.dev` |

Steps:
1. Log in as `lo@origina.dev`.
2. Try to open the admin or user management page directly by URL if the navigation is hidden.
3. Try to create a user if the UI exposes any path.

Expected result:
- Admin page is hidden or access is denied.
- User creation is blocked.
- The app shows an appropriate unauthorized or not-found state, not a broken page.

### S2.4 - Underwriter Submits and Clears a Condition

| Field | Value |
|---|---|
| Tester role | Underwriter |
| Prerequisite | A loan exists with an open condition, or tester can create one |
| Test data | Any active loan |

Steps:
1. Log in as `uw@origina.dev`.
2. Open Loan Pipeline.
3. Open an active loan.
4. Go to the Conditions section.
5. Add a condition, or select an existing open condition.
6. Submit the condition.
7. Clear the submitted condition.

Expected result:
- Condition appears in the list with a status badge.
- Open condition can move to Submitted.
- Submitted condition can move to Cleared.
- Cleared condition records a cleared date/user when shown.

### S2.5 - Waive and Reject Conditions With Reason

| Field | Value |
|---|---|
| Tester role | Underwriter or Account Manager |
| Prerequisite | Loan has open or submitted conditions |
| Test data | Two test conditions |

Steps:
1. Open a loan's Conditions section.
2. Select an open condition.
3. Waive the condition and enter a reason.
4. Create or select another condition.
5. Submit it.
6. Reject it and enter a reason.

Expected result:
- Waived condition shows Waived status and reason when available.
- Rejected condition shows Rejected status and reason when available.
- Terminal statuses cannot be changed again through normal UI actions.

### S2.6 - Invalid Condition Transitions Are Blocked

| Field | Value |
|---|---|
| Tester role | Underwriter |
| Prerequisite | Cleared, waived, or rejected condition exists |
| Test data | A terminal condition from S2.4 or S2.5 |

Steps:
1. Open a terminal condition.
2. Look for actions that would move it back to Open or Submitted.
3. If any action is available, attempt it.

Expected result:
- UI does not offer invalid transitions.
- If attempted, the backend rejects the change and the UI displays an error.
- The condition status remains unchanged.

## Sprint 3 - Full Workspace

**Sprint goal:** A full loan review cycle is possible inside the workspace: notes, audit history, status transitions, underwriting review, and documents.

### S3.1 - Add and View Real Notes

| Field | Value |
|---|---|
| Tester role | Loan Officer, Processor, Underwriter, or Account Manager |
| Prerequisite | Active loan exists |
| Test data | Note text: `UAT note created during Sprint 3 test` |

Steps:
1. Log in and open a loan.
2. Go to Notes or Conversation.
3. Add the test note.
4. Submit the note.
5. Refresh the page.
6. Return to Notes or Conversation.

Expected result:
- Note appears after submission.
- Note remains after refresh.
- Note is associated with the current loan only.

### S3.2 - Audit Log Shows Real Loan Activity

| Field | Value |
|---|---|
| Tester role | Admin, Processor, Underwriter, or Account Manager |
| Prerequisite | Loan has recent activity such as note, condition, document, or status update |
| Test data | Same loan used in S3.1 |

Steps:
1. Open the same loan.
2. Go to Audit Log.
3. Review listed events.
4. Confirm at least one event reflects a recent loan change.

Expected result:
- Audit Log is not hardcoded mock content.
- Events show action, entity/table, date/time, and changed fields when available.

### S3.3 - Change Loan Status With a Reason

| Field | Value |
|---|---|
| Tester role | Processor, Underwriter, or Account Manager |
| Prerequisite | Loan is in a non-terminal status |
| Test data | Reason: `UAT status transition` |

Steps:
1. Open a loan workspace.
2. Go to the Status section or use the top status control.
3. Open Change Status.
4. Select one of the available statuses.
5. Enter the reason.
6. Confirm the transition.
7. Review the status history.

Expected result:
- Only valid next statuses are available.
- Status updates immediately after confirmation.
- History includes the prior status, new status, actor, timestamp, and reason.

### S3.4 - Invalid Loan Status Transition Is Prevented

| Field | Value |
|---|---|
| Tester role | Processor, Underwriter, or Account Manager |
| Prerequisite | Loan in a known current status |
| Test data | Attempt a transition not listed in the UI, if possible |

Steps:
1. Open the Status section.
2. Review available transitions.
3. Confirm that impossible jumps, such as New Draft directly to Approved, are not listed.
4. If a direct URL/API test is being observed by a developer, confirm the app shows a validation error for invalid transitions.

Expected result:
- Invalid transitions are hidden or rejected.
- Loan status remains unchanged after a rejected transition.

### S3.5 - Underwriting Section Loads Decision Data

| Field | Value |
|---|---|
| Tester role | Underwriter |
| Prerequisite | Loan workspace available |
| Test data | Any active loan |

Steps:
1. Log in as `uw@origina.dev`.
2. Open a loan.
3. Go to Underwriting.
4. Review eligibility, pricing, and exceptions panels.
5. If no runs exist, confirm empty states are clear.

Expected result:
- Underwriting section exists and loads without errors.
- Eligibility and pricing panels show real run data when available.
- Exceptions linked to the loan are visible or linked.

### S3.6 - Upload, View, Download, and Archive a Document

| Field | Value |
|---|---|
| Tester role | Loan Officer, Processor, or Underwriter |
| Prerequisite | Documents section wired to backend |
| Test data | Small PDF or text file named `uat-document.txt` |

Steps:
1. Open a loan workspace.
2. Go to Documents.
3. Upload the test file.
4. Confirm it appears in the document list.
5. Download the file.
6. Archive or delete the document.
7. Refresh the document list.

Expected result:
- Upload succeeds.
- File name, document type, size, uploader, and upload time are shown when available.
- Download opens or saves the file.
- Archived document is removed from the active list or marked archived.

## Sprint 4 - Manager Layer

**Sprint goal:** Managers can see team health, analytics filters are live, loans show assignment, and notifications are generated from domain events.

### S4.1 - Pipeline Shows Loan Owner / Assignment

| Field | Value |
|---|---|
| Tester role | Account Manager or Admin |
| Prerequisite | Loans have assigned users |
| Test data | Any loan assigned to a known team member |

Steps:
1. Log in as `am@origina.dev`.
2. Open Loan Pipeline.
3. Confirm an Owner or Assigned To column is visible.
4. Find a loan assigned to a known user.
5. Open the loan and return to the pipeline.

Expected result:
- Pipeline displays assigned user's name.
- Unassigned loans show a clear empty value such as `-`.
- Assignment data remains consistent after opening and returning.

### S4.2 - Filter Pipeline by Assignee and Status

| Field | Value |
|---|---|
| Tester role | Account Manager or Admin |
| Prerequisite | At least two assignees with loans |
| Test data | One selected assignee |

Steps:
1. Open Loan Pipeline.
2. Apply an assignee filter.
3. Confirm all visible loans belong to the selected assignee.
4. Add a status filter.
5. Confirm all visible loans match both filters.
6. Clear filters.

Expected result:
- Assignee filter changes the data shown.
- Status filter combines correctly with assignee filter.
- Clearing filters restores the broader pipeline.

### S4.3 - Analytics Date and Status Filters Change Charts

| Field | Value |
|---|---|
| Tester role | Account Manager, Admin, or Loan Officer |
| Prerequisite | Analytics page uses real backend data |
| Test data | Date preset such as Last 30 Days; status Submitted |

Steps:
1. Open Analytics.
2. Note the current totals and chart values.
3. Apply a date range or preset.
4. Confirm values update.
5. Add a status filter.
6. Confirm values update again.
7. Remove filters.

Expected result:
- Filter bar is not cosmetic.
- Totals and charts refetch or recalculate based on filters.
- Empty filtered results display a usable empty state.

### S4.4 - Manager Dashboard Shows Team KPIs

| Field | Value |
|---|---|
| Tester role | Account Manager |
| Prerequisite | Account manager dashboard built |
| Test data | `am@origina.dev` |

Steps:
1. Log in as `am@origina.dev`.
2. Confirm the app routes to the manager/account-manager dashboard.
3. Review team KPI cards.
4. Review loans by program or status chart.
5. Review team pipeline table.

Expected result:
- Manager dashboard focuses on team health, not only one user's queue.
- KPI values load from real data.
- Team member names and counts are readable.

### S4.5 - Loan Submission Generates Notification Event

| Field | Value |
|---|---|
| Tester role | Loan Officer or Admin |
| Prerequisite | Domain events and notification dispatcher configured |
| Test data | New loan submission |

Steps:
1. Submit a new loan.
2. Confirm the loan appears in the pipeline.
3. Ask the test lead/developer to confirm a `loan.submitted` domain event was created.
4. If email delivery is configured, confirm the expected recipient receives an email.

Expected result:
- Domain event exists for the submitted loan.
- Notification is sent or queued.
- Failure to send email does not roll back the loan submission.

## Sprint 5 - Production Hardening

**Sprint goal:** A real lender can pilot Origina: cookie auth, CI, coverage gates, and tenant onboarding are in place.

### S5.1 - Login Sets Session Cookie and Logout Clears It

| Field | Value |
|---|---|
| Tester role | Any authenticated user |
| Prerequisite | Sprint 5 auth changes deployed |
| Test data | `admin@origina.dev` / `TestPass123!` |

Steps:
1. Open browser developer tools.
2. Go to the Application/Storage cookies panel for the app.
3. Log in.
4. Confirm an `origina_token` cookie exists.
5. Confirm normal navigation still works.
6. Log out.
7. Confirm the app returns to login.
8. Refresh the page.

Expected result:
- `origina_token` cookie is set after login.
- Cookie is marked HttpOnly in browsers that display that flag.
- Logout clears the session.
- Refresh after logout does not re-authenticate the user.

### S5.2 - Protected Pages Require Login

| Field | Value |
|---|---|
| Tester role | Anonymous user |
| Prerequisite | User is logged out |
| Test data | Direct URLs such as `/loans`, `/analytics`, `/settings` |

Steps:
1. Log out.
2. Manually navigate to `http://localhost:3000/loans`.
3. Repeat for `/analytics` and `/settings`.

Expected result:
- Protected pages redirect to login or show an access-denied state.
- No protected loan data is visible while logged out.

### S5.3 - Login Rate Limiting

| Field | Value |
|---|---|
| Tester role | Anonymous user |
| Prerequisite | Rate limiting enabled on `/auth/login` |
| Test data | Known email with wrong password |

Steps:
1. Attempt to log in with a wrong password repeatedly.
2. Continue until the rate limit threshold is reached.
3. Wait for the configured window to reset.
4. Try a valid login.

Expected result:
- Repeated failed login attempts are rate-limited.
- The app displays a sensible error.
- Valid login works again after the rate-limit window resets.

### S5.4 - Bootstrap a New Tenant

| Field | Value |
|---|---|
| Tester role | Platform Admin / Implementation Lead |
| Prerequisite | `ADMIN_SECRET` configured |
| Test data | Tenant name `UAT Lending <date>` and admin email `admin@uat-lending.test` |

Steps:
1. Open the tenant bootstrap/admin page.
2. Enter tenant name.
3. Enter first admin full name, email, and password.
4. Enter the admin secret.
5. Submit the form.
6. Record the returned tenant ID and user ID.
7. Log out.
8. Log in as the new tenant admin.

Expected result:
- Tenant is created.
- First admin user is created.
- New admin can log in.
- New tenant does not see another tenant's loans or users.

### S5.5 - New Tenant Admin Creates Team User

| Field | Value |
|---|---|
| Tester role | New tenant IT Admin |
| Prerequisite | S5.4 complete |
| Test data | New underwriter email `uw@uat-lending.test` |

Steps:
1. Log in as the new tenant admin.
2. Open user management.
3. Create a new user.
4. Assign the `underwriter` role.
5. Log out.
6. Log in as the new underwriter.

Expected result:
- New tenant admin can create users only inside the new tenant.
- Underwriter can log in.
- Underwriter sees role-appropriate navigation.

### S5.6 - CI and Release Readiness Check

| Field | Value |
|---|---|
| Tester role | Product owner, QA lead, or engineering lead |
| Prerequisite | GitHub Actions configured |
| Test data | Latest feature branch or pull request |

Steps:
1. Open the latest pull request or branch checks in GitHub.
2. Confirm backend tests ran.
3. Confirm frontend tests ran.
4. Confirm TypeScript check ran.
5. Confirm production build check ran.
6. Confirm backend coverage is at or above 70 percent.

Expected result:
- CI jobs are visible and green.
- Failed tests or coverage failures block merge.
- Sprint 1-5 end-user scripts have pass/fail results recorded.

## Final Pilot-Readiness Walkthrough

Run this after Sprint 5 passes.

Steps:
1. Bootstrap a new tenant.
2. Log in as the new tenant admin.
3. Create a loan officer, processor, underwriter, and account manager.
4. Log in as the loan officer.
5. Submit a new loan.
6. Log in as the processor.
7. Open the loan, add a note, upload a document, and move status forward.
8. Log in as the underwriter.
9. Add, submit, clear, waive, and reject conditions as appropriate.
10. Review underwriting, exceptions, and audit log.
11. Log in as the account manager.
12. Review pipeline assignment, analytics filters, and manager dashboard.
13. Log out and verify protected pages are inaccessible.

Expected result:
- A lender can complete the core LOS/TPO pilot workflow without developer intervention.
- All major role-based workflows are represented.
- Remaining issues are documented as pilot risks or post-pilot enhancements.

