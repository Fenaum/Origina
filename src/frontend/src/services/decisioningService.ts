import { apiRequest } from "@/services/apiClient";
import type { EligibilityRunOut, PricingRunOut } from "@/types/api";

/**
 * Sprint 3 §3.3: decisioning data wiring for the Underwriting workspace tab.
 *
 * Backend returns the pagination envelope ({items, total}); unwrap here.
 */
async function listEnvelope<T>(path: string, token: string): Promise<T[]> {
  const data = await apiRequest<{ items: T[]; total: number }>(path, { token });
  return data.items ?? [];
}

export async function listPricingRuns(loanId: string, token: string): Promise<PricingRunOut[]> {
  return listEnvelope<PricingRunOut>(`/pricing-runs/?loan_id=${loanId}`, token);
}

export async function listEligibilityRuns(loanId: string, token: string): Promise<EligibilityRunOut[]> {
  return listEnvelope<EligibilityRunOut>(`/eligibility-runs/?loan_id=${loanId}`, token);
}

export async function createPricingRun(
  loanId: string,
  payload: { input_hash: string; input_payload: Record<string, unknown>; output_payload: Record<string, unknown> },
  token: string,
): Promise<PricingRunOut> {
  return apiRequest<PricingRunOut>("/pricing-runs/", {
    method: "POST",
    body: JSON.stringify({ loan_id: loanId, ...payload }),
    token,
  });
}

export async function createEligibilityRun(
  loanId: string,
  payload: { input_hash: string; input_payload: Record<string, unknown>; output_payload: Record<string, unknown> },
  token: string,
): Promise<EligibilityRunOut> {
  return apiRequest<EligibilityRunOut>("/eligibility-runs/", {
    method: "POST",
    body: JSON.stringify({ loan_id: loanId, ...payload }),
    token,
  });
}
