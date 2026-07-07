import { mockLoans } from "@/data/mockLoans";
import { apiRequest } from "@/services/apiClient";
import type { LoanPipelineSummaryOut, PaginatedResponse } from "@/types/api";
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

/**
 * A single page of pipeline results plus the server-reported total.
 * The grid uses `total` to render page controls (Prev / Next) without a
 * second request.
 */
export type PipelinePage = {
  loans: LoanSummary[];
  total: number;
};

/**
 * Fetch a page of loans from the pipeline endpoint.
 *
 * The backend returns a paginated envelope: `{items: [...], total: n}`.
 * Unauthenticated callers (no JWT) fall back to the in-memory mock list
 * so the demo UI still renders before login.
 */
export async function listLoans(
  token?: string,
  options: { skip?: number; limit?: number } = {},
): Promise<PipelinePage> {
  if (process.env.NEXT_PUBLIC_MOCK_LOAN_API_ERROR === "true") {
    throw new Error("Mock loan API error");
  }

  if (!token) {
    return { loans: mockLoans, total: mockLoans.length };
  }

  const params = new URLSearchParams();
  params.set("skip", String(options.skip ?? 0));
  params.set("limit", String(options.limit ?? 50));

  const data = await apiRequest<PaginatedResponse<LoanPipelineSummaryOut>>(
    `/loans/pipeline?${params.toString()}`,
    { token },
  );
  return {
    loans: data.items.map(toSummary),
    total: data.total,
  };
}

/**
 * Look up a single loan summary by ID.
 *
 * Sprint 1 fallback: pipeline scan with limit=1000. A real Sprint 2 endpoint
 * (`GET /loans/{id}` + dedicated borrower fetch) replaces this.
 */
export async function getLoanById(
  loanId: string,
  token?: string,
): Promise<LoanSummary | null> {
  if (!token) {
    return mockLoans.find((loan) => loan.id === loanId) ?? null;
  }

  const data = await apiRequest<PaginatedResponse<LoanPipelineSummaryOut>>(
    "/loans/pipeline?skip=0&limit=1000",
    { token },
  );
  const row = data.items.find((r) => r.id === loanId);
  return row ? toSummary(row) : null;
}