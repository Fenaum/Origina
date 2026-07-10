import { apiRequest } from "@/services/apiClient";
import type { NoteOut } from "@/types/api";

/**
 * Sprint 3 §3.1: notes conversation wiring.
 *
 * Backend returns the pagination envelope ({items, total}); we unwrap it
 * here so callers receive a flat array (oldest-first → see WorkspaceConversation).
 */
async function listEnvelope(
  path: string,
  token: string,
): Promise<NoteOut[]> {
  const data = await apiRequest<{ items: NoteOut[]; total: number }>(path, { token });
  return data.items ?? [];
}

export async function listNotes(loanId: string, token: string): Promise<NoteOut[]> {
  return listEnvelope(`/notes/?loan_id=${loanId}&limit=100`, token);
}

export async function createNote(
  loanId: string,
  body: string,
  token: string,
): Promise<NoteOut> {
  return apiRequest<NoteOut>("/notes/", {
    method: "POST",
    body: JSON.stringify({ loan_id: loanId, body }),
    token,
  });
}
