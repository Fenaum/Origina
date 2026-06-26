# Loan Workspace Architecture

> Part of [Architecture Index](README.md)

---

## URL Pattern

```
/loans/[loanId]?section=<name>
```

Section is controlled by the `?section=` query param (shallow push — no full reload).

---

## Layout

`LoanWorkspaceLayout` — sidebar only, no global TopHeader. The loan's sticky topbar is the page header.

---

## Sticky Topbar (always visible)

- Breadcrumb ← Pipeline
- Borrower name + loan number
- Status pill
- Loan amount, program, subject property state

---

## Section Navigation

Horizontal tab bar with primary sections. Less-used sections overflow into a "More ▾" dropdown.

---

## Current Sections

| Group | Sections |
|---|---|
| Primary | Home, Processing, Underwriting, Conditions, Documents, Notes |
| More | Borrower URLA, Parties, Income, Exceptions, Tasks, Appraisal, Credit, Escrow, Title, Audit Log |

Sections are defined in `src/components/loans/workspace/workspaceSections.ts`.

---

## WorkspaceHome

Shows loan summary (8 header fields from `LoanSummary`), open conditions count, document status. Registers the loan in Recent Files (Zustand + localStorage, last 5 loans via `recentLoansStore`).
