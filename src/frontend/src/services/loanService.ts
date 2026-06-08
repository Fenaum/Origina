import { mockLoans } from "@/data/mockLoans";
import type { LoanSummary } from "@/types/loan";

const MOCK_DELAY_MS = process.env.NODE_ENV === "production" ? 0 : 180;

function waitForMockDelay() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MOCK_DELAY_MS);
  });
}

export async function listLoans(): Promise<LoanSummary[]> {
  if (MOCK_DELAY_MS > 0) {
    await waitForMockDelay();
  }

  if (process.env.NEXT_PUBLIC_MOCK_LOAN_API_ERROR === "true") {
    throw new Error("Mock loan API error");
  }

  return mockLoans;
}

export async function getLoanById(loanId: string): Promise<LoanSummary | null> {
  return mockLoans.find((loan) => loan.id === loanId) ?? null;
}
