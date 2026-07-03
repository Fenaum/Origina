// Smoke tests for the LoanPipelineTable component.
//
// See ROADMAP.md "Testing Checkpoints" §A.2.
//
// These two tests prove the harness works end-to-end: vitest picks up the
// file, jsdom provides DOM globals, @testing-library/jest-dom matchers are
// available, and `@/*` path aliases resolve to `src/frontend/src/*`.
//
// Future tests for the pipeline grid (pagination wiring — see ROADMAP §B)
// will live alongside this file.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoanPipelineTable } from "@/components/loans/LoanPipelineTable";
import type { LoanSummary } from "@/types/loan";

const baseLoan: LoanSummary = {
  id: "loan-1",
  borrowerName: "Alex Rivera",
  loanNumber: "OQ-2026-0001",
  channel: "Broker",
  status: "submitted",
  loanAmount: 750_000,
  loanProgram: "dscr",
  propertyState: "CA",
  submittedAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-25T00:00:00Z",
  owner: "Jordan Lee",
  conditionsOpen: 0,
  conditionsSubmitted: 0,
  actionsNeeded: 0,
};

describe("LoanPipelineTable", () => {
  it("renders_empty_state_when_no_loans", () => {
    render(<LoanPipelineTable loans={[]} />);

    // EmptyState component renders its title and description.
    expect(screen.getByText(/no loans found/i)).toBeInTheDocument();
  });

  it("renders_table_rows_for_loans", () => {
    render(
      <LoanPipelineTable
        loans={[
          baseLoan,
          { ...baseLoan, id: "loan-2", loanNumber: "OQ-2026-0002", borrowerName: "Sam Patel" },
        ]}
      />
    );

    // Both loan numbers appear as links.
    expect(screen.getByText("OQ-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("OQ-2026-0002")).toBeInTheDocument();

    // Both borrower names appear in the table body.
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Sam Patel")).toBeInTheDocument();

    // The header count reflects two loans.
    expect(screen.getByText(/2 active files/i)).toBeInTheDocument();
  });
});