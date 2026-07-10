import { apiRequest } from "@/services/apiClient";
import type { AuditLogEntry } from "@/types/api";

/**
 * Sprint 3 §3.1: audit log wiring for the workspace.
 *
 * The backend returns the pagination envelope ({items, total}). We unwrap it
 * here so callers receive a flat array.
 */
async function listEnvelope(
  path: string,
  token: string,
): Promise<AuditLogEntry[]> {
  const data = await apiRequest<{ items: AuditLogEntry[]; total: number }>(path, { token });
  return data.items ?? [];
}

export async function listAuditLogs(
  entityId: string,
  token: string,
): Promise<AuditLogEntry[]> {
  return listEnvelope(`/audit-logs/?entity_id=${entityId}&limit=100`, token);
}
