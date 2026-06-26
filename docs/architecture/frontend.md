# Frontend Architecture

> Part of [Architecture Index](README.md)

---

## Stack

- Next.js 16 (page router — not App Router)
- TypeScript strict mode
- Tailwind CSS v4
- **@tanstack/react-query** — server-state caching, optimistic updates, background refetch (added Phase 1)
- Zustand 5 with `persist` + `immer` middleware
- Recharts for data visualization
- CSS design system via variables in `globals.css` (no CSS-in-JS)

---

## Directory Structure

```
src/
  pages/             Next.js routes
    _app.tsx         QueryClientProvider + AuthProvider wrapper
    _legacy/         Archived placeholder pages (do not route, do not delete)
    analytics/
    borrower/        Intake + application flow
    dashboard/       Role dashboards
    exceptions/      Pre-file exceptions page
    loans/           Pipeline + loan workspace
    login.tsx
    settings/        User settings (profile, security, notifications, preferences)
    admin/           Org admin (people, products, workflow, audit log, etc.)
  components/
    app/             Shell: AppLayout, LoanWorkspaceLayout, Sidebar, TopHeader
    borrower/        Intake UI
    charts/          Recharts wrappers
    dashboard/       KPI cards, PageHeader
    feedback/        LoadingSpinner, EmptyState, ErrorState, skeletons
    loans/           Pipeline + workspace components
      pipeline/      Toolbar, KPIs, Grid, FilterPanel, action modals
      workspace/     WorkspaceHome, section components, workspaceSections.ts
    settings/        SettingsLayout, SectionCard, SaveBar, SearchableSectionNav
    submission/      Multi-step loan submission wizard
  hooks/             useAuth, useLoans, useLoan, useCurrentUser, …
  services/          apiClient.ts, loanService.ts, submissionService.ts
  state/             auth.tsx, pipelineStore.ts, recentLoansStore.ts
  lib/               utils.ts (cn, formatCurrency, formatDate, formatPercent)
                     exceptionConstants.ts (shared exception UI constants)
  types/             auth.ts, loan.ts, dashboard.ts, api.ts, submission.ts
  data/              pipelineAnalytics.ts, pipelineFilters.ts, questions.ts, mockLoans.ts
  styles/            globals.css (design system + all component CSS)
```

---

## Layout System

| Layout | Used by | Structure |
|---|---|---|
| `AppLayout` | Most pages | Sidebar + TopHeader + padded content |
| `LoanWorkspaceLayout` | Loan workspace | Sidebar only (loan topbar is the header) |
| `SettingsLayout` | Settings + Admin pages | In-page rail + content cards + sticky SaveBar |

---

## State Management

| Store | Storage | Purpose |
|---|---|---|
| `auth.tsx` | localStorage (`origina.token`) | JWT token, current user, preview role |
| `pipelineStore.ts` | localStorage (`origina.pipeline.v1`) | Sort, columns, saved views |
| `recentLoansStore.ts` | localStorage (`origina.recent-loans`) | Last 5 viewed loan files |
| `intakeStore.ts` | sessionStorage | Intake answers (cleared on tab close) |
| `submissionStore.ts` | localStorage | Loan submission draft |
| `documentStore.ts` | In-memory | Document upload state (not persisted) |

**SSN invariant:** `submissionStore.ts` `partialize` strips `borrowers[].ssn` before every localStorage write. SSN lives in Zustand memory only during the session.

---

## React Query Usage

`QueryClientProvider` wraps the entire app in `_app.tsx`. All data-fetching hooks in `src/hooks/` use `useQuery`/`useMutation` rather than raw `useEffect + useState`.

Standard pattern for a read hook:
```ts
export function useCurrentUser() {
  const { token } = useAuth();
  return useQuery<UserOut>({
    queryKey: ["currentUser"],
    queryFn: () => apiRequest<UserOut>("/auth/me", { token: token ?? undefined }),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
```

Standard pattern for a mutation:
```ts
const mutation = useMutation({
  mutationFn: (data: ProfileUpdate) => apiRequest("/users/me", { method: "PATCH", body: JSON.stringify(data), token }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
});
```

Do not write `useEffect + fetch` loops for any page that fetches data from the API.

---

## Data Flow

```
Login → POST /auth/login → JWT in localStorage
  → apiClient.ts injects Bearer header
  → service layer (loanService, submissionService, etc.)
  → React Query hooks (useLoans, useLoan, useCurrentUser, …)
  → components render with cached data

Pipeline: all loans loaded once → client-side filter+sort via pipelineFilters.ts
Intake: anonymous → POST /intake/session → /intake/answers → /intake/rank → /intake/handoff
Submission: form state in Zustand → saveDraft (localStorage) → submitLoan (POST /loans/{id}/submit)
```

---

## Type Conventions

- `src/types/api.ts` — backend response shapes, mirrors Pydantic `*Out` schemas; keep in sync
- `src/types/loan.ts` — pipeline display types (`LoanProgram` includes conventional/other)
- `src/types/submission.ts` — submission wizard types (`LoanProgram` is Non-QM subset only)
- Import alias: `@/*` maps to `src/frontend/src/`
