// tests/frontend/WorkspaceDocuments.test.tsx
//
// Sprint 5 §5.2 — smoke test for the documents workspace section.
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WorkspaceDocuments } from "@/components/loans/workspace/WorkspaceDocuments";
import type { LoanSummary } from "@/types/loan";

vi.mock("@/services/documentsService", () => ({
  listDocuments: vi.fn().mockResolvedValue([
    {
      id: "doc-1",
      loan_id: "loan-1",
      file_name: "bank_statement.pdf",
      category: "Income",
      mime_type: "application/pdf",
      size_bytes: 102400,
      uploaded_at: "2026-07-01T12:00:00Z",
      uploaded_by: "u1",
      archived_at: null,
    },
  ]),
  uploadDocument: vi.fn().mockResolvedValue({ id: "doc-2" }),
  archiveDocument: vi.fn().mockResolvedValue(undefined),
  buildDocumentDownloadUrl: vi.fn().mockReturnValue("/api/v1/documents/doc-1/download"),
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

describe("WorkspaceDocuments", () => {
  it("renders without crashing", () => {
    const { container } = render(<WorkspaceDocuments loan={mockLoan} />);
    expect(container).toBeInTheDocument();
  });
});
