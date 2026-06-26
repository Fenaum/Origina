# Exception Module Architecture

> Part of [Architecture Index](README.md)

---

## Tables

```
exceptions                     — core record (loan_id nullable for pre-file)
  ├── exception_events         — append-only action log
  ├── exception_comments       — append-only comment thread
  ├── exception_documents      — junction: exceptions ↔ documents
  └── exception_conditions     — conditions attached to approved exceptions
exception_authority_rules      — tenant-configurable approval authority matrix
```

---

## Exception Lifecycle

```
pre_file (loan_id = NULL)  →  submitted  →  assigned  →  under_review
  →  approved / approved_with_conditions / denied / withdrawn

approved pre-file  →  POST /exceptions/{id}/link-loan  →  loan_file (loan_id set)
```

---

## Pre-File Exceptions

- Created without a loan (`loan_id = NULL`, `exception_source = "pre_file"`)
- AE/broker submits to get advance approval for a guideline variance before a loan exists
- On loan creation, approved pre-file exceptions can be linked via `POST /exceptions/{id}/link-loan`
- Link sets `loan_id` in-place (conversion model, not copy)
- Accessible via global `/exceptions` page in sidebar (AE and broker roles)
- Surfaced in submission ReviewSummary with "Attach to Loan" button
- `withdraw_exception` allows withdrawal from any non-terminal status

---

## Authority Rules

`exception_authority_rules` controls who can approve what severity at what exception type. Enforced in `decide_exception()` service function. Supports `requires_dual_approval` for high-severity variances.

---

## 25 API Routes

| Group | Routes |
|---|---|
| CRUD | `GET/POST /exceptions/`, `GET/PATCH/DELETE /exceptions/{id}` |
| Workflow | submit, assign, start-review, request-info, decide, withdraw, reopen |
| Conditions | list, satisfy, waive |
| Analytics | summary, approver-queue |
| Linking | `POST /exceptions/{id}/link-loan` |

---

## Frontend

- `WorkspaceExceptions` — Phase 2 UI (structured form, factor selector, metric fields)
- `DecideForm` — Phase 3 UI (decision type radio, rationale, condition builder)
- `SummaryStats` bar — Phase 4 UI
- Shared constants in `src/lib/exceptionConstants.ts`
