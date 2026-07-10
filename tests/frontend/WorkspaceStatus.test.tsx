// tests/frontend/WorkspaceStatus.test.tsx
//
// Sprint 5 §5.2 — every workspace section needs a render-without-crash smoke
// test. WorkspaceStatus renders the current status, available transitions,
// and a "what's next" callout. We mock the apiClient that fetches transitions
// and assert the component mounts without throwing.
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WorkspaceStatus } from "@/components/loans/workspace/WorkspaceStatus";
import type { LoanSummary } from "@/types/loan";

vi.mock("@/services/apiClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({
    current_status: "submitted",
    current_status_label: "Submitted",
    is_terminal: false,
    available_transitions: [
      { status: "conditions_review", label: "Conditions Review" },
    ],
  }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({ token: "mock-token", user: { role: "loan_officer" } }),
}));

const mockLoan: LoanSummary = {
  id: "loan-1",
  loanNumber: "OR-1001",
  borrowerName: "Jane Smith",
  status: "submitted",
  loanAmount: 450000,
  loanProgram: "dscr",
  channel: "Broker",
  propertyState: "FL",
  owner: "—",
  conditionsOpen: 0,
  conditionsSubmitted: 0,
  actionsNeeded: 0,
  submittedAt: "2026-07-01",
  updatedAt: "2026-07-01",
};

describe("WorkspaceStatus", () => {
  it("renders without crashing", () => {
    const { container } = render(<WorkspaceStatus loan={mockLoan} />);
    expect(container).toBeInTheDocument();
  });
});
