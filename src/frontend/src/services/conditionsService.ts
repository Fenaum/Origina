import { apiRequest } from "@/services/apiClient";
import type { ConditionOut, ConditionStage } from "@/types/api";

export async function listConditions(loanId: string, token: string): Promise<ConditionOut[]> {
  return apiRequest<ConditionOut[]>(`/conditions/?loan_id=${loanId}`, { token });
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
  payload: { name?: string; description?: string; stage?: ConditionStage; status?: string },
  token: string,
): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

export async function submitCondition(id: string, token: string): Promise<ConditionOut> {
  return apiRequest<ConditionOut>(`/conditions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "submitted" }),
    token,
  });
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

export async function deleteCondition(id: string, token: string): Promise<void> {
  await apiRequest<void>(`/conditions/${id}`, { method: "DELETE", token });
}
