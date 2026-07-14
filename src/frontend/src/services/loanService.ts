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
    // Sprint 4 §4.1 — pipeline owner column pulls from the API now.
    owner: row.assigned_to_name ?? "—",
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
  options: { skip?: number; limit?: number; assignedTo?: string; status?: string } = {},
): Promise<PipelinePage> {
  if (process.env.NEXT_PUBLIC_MOCK_LOAN_API_ERROR === "true") {
    throw new Error("Mock loan API error");
  }

  if (!token) {
    let loans = mockLoans;
    if (options.assignedTo) loans = loans.filter((l) => (l as unknown as { assignedTo?: string }).assignedTo === options.assignedTo);
    if (options.status) loans = loans.filter((l) => l.status === options.status);
    return { loans, total: loans.length };
  }

  const params = new URLSearchParams();
  params.set("skip", String(options.skip ?? 0));
  params.set("limit", String(options.limit ?? 50));
  if (options.assignedTo) params.set("assigned_to", options.assignedTo);
  if (options.status) params.set("status_filter", options.status);

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
  // Sprint 6 §6.2 — switch to `GET /loans/{id}/detail` for authenticated
  // callers. The previous implementation fetched the full pipeline page
  // with `limit=1000` to find a single loan, which scaled badly and
  // violated "don't scan, query".
  //
  // The summary row the workspace uses is also exposed by the detail
  // endpoint via `primary_borrower` + `subject_property`. We project
  // back to the existing `LoanSummary` shape so callers don't have to
  // migrate in lockstep. Unauthenticated callers keep the mock fallback.
  if (!token) {
    return mockLoans.find((loan) => loan.id === loanId) ?? null;
  }

  try {
    const detail = await apiRequest<import("@/types/api").LoanDetailOut>(
      `/loans/${loanId}/detail`,
      { token },
    );
    const primary = detail.primary_borrower;
    const subject = detail.subject_property;
    return {
      id: detail.id,
      borrowerName: [primary?.first_name, primary?.last_name]
        .filter(Boolean)
        .join(" ") || "—",
      loanNumber: detail.loan_number ?? "—",
      channel: "Broker",
      status: detail.status as LoanStatus,
      loanAmount: Number(detail.financials?.loan_amount ?? 0),
      loanProgram: (detail.loan_program ?? "other") as LoanProgram,
      propertyState: subject?.state ?? "—",
      submittedAt: detail.submitted_at ?? null,
      updatedAt: detail.updated_at.split("T")[0],
      owner: "—",
      conditionsOpen: 0,
      conditionsSubmitted: 0,
      actionsNeeded: 0,
    };
  } catch {
    return null;
  }
}