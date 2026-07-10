import { apiRequest } from "@/services/apiClient";
import type { ExceptionOut } from "@/types/api";

/**
 * Sprint 3 §3.3: exceptions are surfaced inside the Underwriting workspace
 * tab so the underwriter can see outstanding exceptions without leaving the
 * file. Full exception management still lives at /exceptions.
 */
async function listEnvelope(path: string, token: string): Promise<ExceptionOut[]> {
  const data = await apiRequest<{ items: ExceptionOut[]; total: number }>(path, { token });
  return data.items ?? [];
}

export async function listExceptions(loanId: string, token: string): Promise<ExceptionOut[]> {
  return listEnvelope(`/exceptions/?loan_id=${loanId}`, token);
}
