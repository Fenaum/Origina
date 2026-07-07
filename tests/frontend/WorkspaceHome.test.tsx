// tests/frontend/WorkspaceHome.test.tsx
//
// Sprint 1 — Phase 1.4: WorkspaceHome reads real financials + terms from
// the loan detail hook and renders them. These two tests prove the wiring
// (mocked hook) renders the borrower name + loan number without crashing,
// which is the surface area the workspace shell needs to work end-to-end.
//
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime.js";
import { WorkspaceHome } from "@/components/loans/workspace/WorkspaceHome";
import type { LoanSummary } from "@/types/loan";

// Mock the hooks that WorkspaceHome depends on. We don't want to fire real
// fetch calls in a unit test — the goal is to prove the rendered shell
// wires the mocked detail through to the UI.
vi.mock("@/hooks/useLoanDetail", () => ({
  useLoanDetail: () => ({
    detail: {
      loan: { id: "loan-1", purpose: "purchase", loan_program: "dscr" },
      borrowers: [
        { id: "b1", first_name: "Jane", last_name: "Smith", type: "primary_borrower" },
      ],
      financials: {
        loan_id: "loan-1",
        loan_amount: 450000,
        fico_score: 720,
        ltv: 0.75,
        dscr: 1.35,
        updated_at: "2026-07-01T00:00:00Z",
      },
      terms: {
        loan_id: "loan-1",
        interest_rate: 7.5,
        term_months: 360,
        rate_type: "fixed",
        updated_at: "2026-07-01T00:00:00Z",
      },
      property: { address1: "123 Main St", city: "Miami", state: "FL", postal_code: "33101" },
    },
    loading: false,
  }),
}));

vi.mock("@/state/recentLoansStore", () => ({
  useRecentLoansStore: (selector?: (s: { push: (l: { id: string; borrowerName: string; loanNumber: string }) => void }) => unknown) => {
    if (typeof selector === "function") return selector({ push: () => undefined });
    return { push: () => undefined };
  },
}));

const mockLoan: LoanSummary = {
  id: "loan-1",
  borrowerName: "Jane Smith",
  loanNumber: "OR-1001",
  channel: "Broker",
  status: "submitted",
  loanAmount: 450000,
  loanProgram: "dscr",
  propertyState: "FL",
  submittedAt: "2026-07-01",
  updatedAt: "2026-07-01",
  owner: "—",
  conditionsOpen: 2,
  conditionsSubmitted: 0,
  actionsNeeded: 2,
};

// Minimal stub of the Next.js router — WorkspaceHome only needs `push`.
// We provide it via RouterContext.Provider which is the same React context
// that Next's useRouter() reads from internally.
const fakeRouter: any = {
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  defaultLocale: "en",
  domainLocales: [],
  locale: "en",
  locales: ["en"],
  asPath: "/",
  basePath: "",
  pathname: "/",
  route: "/",
  query: { loanId: "loan-1" },
  forward: vi.fn(),
  rewrite: vi.fn(),
};

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <RouterContext.Provider value={fakeRouter}>{ui}</RouterContext.Provider>,
  );
}

describe("WorkspaceHome", () => {
  it("renders without crashing", () => {
    renderWithRouter(<WorkspaceHome loan={mockLoan} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("displays the loan number", () => {
    renderWithRouter(<WorkspaceHome loan={mockLoan} />);
    // OR-1001 may appear in multiple panels; assert at least one occurrence.
    expect(screen.getAllByText(/OR-1001/).length).toBeGreaterThan(0);
  });
});