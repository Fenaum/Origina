import { apiRequest } from "@/services/apiClient";
import type { DocumentOut } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/**
 * Sprint 3 §3.4: documents wiring for the workspace.
 *
 * Notes:
 *  - listDocuments returns the bare array because the backend exposes
 *    /documents/ as a flat list (this endpoint pre-dates the pagination
 *    envelope introduced in Sprint 1).
 *  - uploadDocument bypasses apiRequest() because apiRequest sets
 *    Content-Type: application/json, which breaks multipart/form-data.
 *    We hit fetch directly so the browser sets the correct boundary.
 */
export async function listDocuments(loanId: string, token: string): Promise<DocumentOut[]> {
  return apiRequest<DocumentOut[]>(`/documents/?loan_id=${loanId}`, { token });
}

export async function uploadDocument(
  loanId: string,
  file: File,
  options: { docType?: string; conditionId?: string },
  token: string,
): Promise<DocumentOut> {
  const form = new FormData();
  form.append("loan_id", loanId);
  form.append("file", file);
  if (options.docType) form.append("doc_type", options.docType);
  if (options.conditionId) form.append("condition_id", options.conditionId);
  form.append("tags", "{}");

  const resp = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!resp.ok) {
    let detail = `Upload failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore — keep the status code in the message
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<DocumentOut>;
}

export async function archiveDocument(id: string, token: string): Promise<DocumentOut> {
  return apiRequest<DocumentOut>(`/documents/${id}`, { method: "DELETE", token });
}

export function buildDocumentDownloadUrl(id: string): string {
  return `${API_BASE_URL}/documents/${id}/download`;
}
