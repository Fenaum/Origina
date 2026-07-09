import { apiRequest } from "@/services/apiClient";
import type { ConditionOut, ConditionStage } from "@/types/api";

/**
 * Sprint 2: the backend now returns the pagination envelope for every
 * list endpoint. The helper unwraps `{items, total}` → `items[]` at the
 * service boundary so callers stay flat.
 */
async function listEnvelope(
  path: string,
  token: string,
): Promise<ConditionOut[]> {
  const data = await apiRequest<{ items: ConditionOut[]; total: number }>(path, { token });
  return data.items ?? [];
}

export async function listConditions(loanId: string, token: string): Promise<ConditionOut[]> {
  return listEnvelope(`/conditions/?loan_id=${loanId}`, token);
}

export async function createCondition(
  payload: { loan_id: string; name: string; description?: string; stage: ConditionStage; condition_number: number },
  token: string,
): Promise<ConditionOut> {
  return apiRequest<ConditionOut>("/conditions/", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateCondition(
  id: string,
  payload: { name?: string; description?: string; stage?: ConditionStage },
  token: string,
): Promise<ConditionOut> {
  // Backend rejects PATCH of `status` — only the dedicated lifecycle endpoints
  // (submit/clear/waive/reject) may transition status. Omit it from the payload.
  return apiRequest<ConditionOut>(`/conditions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

/**
 * open → submitted. Dedicated lifecycle endpoint (added in Sprint 2) — the
 * previous PATCH-status implementation bypassed the state machine.
 */
export async function submitCondition(id: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/submit`, { method: "POST", token });
}

export async function clearCondition(id: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/clear`, { method: "POST", token });
}

export async function waiveCondition(id: string, reason: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/waive`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    token,
  });
}

/** Sprint 2: submitted → rejected. UNDERWRITER and ACCOUNT_MANAGER only. */
export async function rejectCondition(id: string, reason: string | undefined, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    token,
  });
}

export async function deleteCondition(id: string, token: string): Promise<void> {
  await apiRequest<void>(`/conditions/${id}`, { method: "DELETE", token });
}
