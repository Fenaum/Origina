// tests/frontend/WorkspaceConversation.test.tsx
//
// Sprint 5 §5.2 — smoke test for the conversation (notes) workspace section.
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WorkspaceConversation } from "@/components/loans/workspace/WorkspaceConversation";
import type { LoanSummary } from "@/types/loan";

vi.mock("@/services/notesService", () => ({
  listNotes: vi.fn().mockResolvedValue([
    {
      id: "n1",
      loan_id: "loan-1",
      author_id: "u1",
      author_name: "Jane LO",
      body: "Sent initial disclosure",
      visibility: "internal",
      created_at: "2026-07-01T12:00:00Z",
    },
  ]),
  createNote: vi.fn().mockResolvedValue({
    id: "n2",
    loan_id: "loan-1",
    body: "New note",
    created_at: "2026-07-02T12:00:00Z",
  }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({ token: "mock-token", user: { role: "loan_officer", full_name: "Jane LO" } }),
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

describe("WorkspaceConversation", () => {
  it("renders without crashing", () => {
    const { container } = render(<WorkspaceConversation loan={mockLoan} />);
    expect(container).toBeInTheDocument();
  });
});
