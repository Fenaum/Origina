import { mockLoans } from "@/data/mockLoans";
import { apiRequest } from "@/services/apiClient";
import type { LoanPipelineSummaryOut } from "@/types/api";
import type { LoanProgram, LoanStatus, LoanSummary } from "@/types/loan";

function toSummary(row: LoanPipelineSummaryOut): LoanSummary {
  return {
    id: row.id,
    borrowerName: row.borrower_name,
    loanNumber: row.loan_number ?? "—",
    channel: "Broker",
    status: row.status as LoanStatus,
    loanAmount: Number(row.loan_amount ?? 0),
    loanProgram: (row.loan_program ?? "other") as LoanProgram,
    propertyState: row.property_state ?? "—",
    submittedAt: row.submitted_at ?? null,
    updatedAt: row.updated_at.split("T")[0],
    owner: "—",
    conditionsOpen: row.conditions_open,
    conditionsSubmitted: row.conditions_submitted,
    actionsNeeded: row.actions_needed,
  };
}

export async function listLoans(token?: string): Promise<LoanSummary[]> {
  if (process.env.NEXT_PUBLIC_MOCK_LOAN_API_ERROR === "true") {
    throw new Error("Mock loan API error");
  }

  if (!token) return mockLoans;

  const rows = await apiRequest<LoanPipelineSummaryOut[]>("/loans/pipeline", {
    token,
  });
  return rows.map(toSummary);
}

export async function getLoanById(
  loanId: string,
  token?: string,
): Promise<LoanSummary | null> {
  if (!token) {
    return mockLoans.find((loan) => loan.id === loanId) ?? null;
  }

  const rows = await apiRequest<LoanPipelineSummaryOut[]>("/loans/pipeline", {
    token,
  });
  const row = rows.find((r) => r.id === loanId);
  return row ? toSummary(row) : null;
}
