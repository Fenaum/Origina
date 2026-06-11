/**
 * Document store — manages the upload checklist and document state.
 *
 * Phase 1 upload flow:
 *   uploadDocument(docType, file, loanId) →
 *     POST /documents/upload (multipart/form-data)
 *     → sets checklist item to "uploaded" with real document ID from backend
 *
 * loanId must be a real DB UUID (not "draft-…") for uploads to succeed.
 * Pass it from the submission store's draft.loanId at the call site.
 *
 * Token strategy (Phase 1):
 *   Reads JWT from localStorage under the same key used by auth.tsx.
 *   Phase 2 TODO: inject token explicitly or share it via a dedicated auth store.
 *
 * Phase 3 TODO: no changes needed here — the upload endpoint URL is the same
 *   regardless of whether the backend stores to local disk or S3.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateDocumentChecklist } from "@/data/submissionConfig";
import type {
  BorrowerDraft,
  DocumentChecklistItem,
  LoanProgram,
} from "@/types/submission";
import type { DocumentOut } from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "origina.token";

type UploadState = {
  status: "idle" | "uploading" | "error";
  progress: number;
  errorMessage?: string;
};

type DocumentStore = {
  checklist: DocumentChecklistItem[];
  uploads: Record<string, UploadState>;
  previewing: string | null;
  uploadedDocs: Record<string, DocumentOut>;
  generateChecklist: (product: LoanProgram | null, borrowers?: BorrowerDraft[]) => void;
  uploadDocument: (docType: string, file: File, loanId: string | null | undefined) => Promise<void>;
  removeDocument: (docType: string) => void;
  setPreview: (docType: string | null) => void;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    (set, get) => ({
      checklist: generateDocumentChecklist(null),
      uploads: {},
      previewing: null,
      uploadedDocs: {},

      generateChecklist: (product) =>
        set({ checklist: generateDocumentChecklist(product) }),

      uploadDocument: async (docType, file, loanId) => {
        const token = getToken();

        // Mark uploading immediately for responsive UI.
        set({
          uploads: {
            ...get().uploads,
            [docType]: { status: "uploading", progress: 0 },
          },
        });

        // Fall back to mock when unauthenticated or loanId is not a real DB UUID.
        if (!token || !loanId || loanId.startsWith("draft-")) {
          await new Promise((res) => window.setTimeout(res, 260));
          set({
            checklist: get().checklist.map((item) =>
              item.docType === docType
                ? { ...item, uploadStatus: "uploaded", fileId: crypto.randomUUID(), fileName: file.name, rejectionReason: null }
                : item,
            ),
            uploads: { ...get().uploads, [docType]: { status: "idle", progress: 100 } },
          });
          return;
        }

        try {
          const form = new FormData();
          form.append("file", file);
          form.append("loan_id", loanId);
          form.append("doc_type", docType);

          const response = await fetch(`${API_BASE}/documents/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            // Do NOT set Content-Type — browser sets it with the correct
            // multipart boundary when FormData is the body.
            body: form,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null) as { detail?: string } | null;
            throw new Error(body?.detail ?? `Upload failed: ${response.status}`);
          }

          const doc = await response.json() as DocumentOut;

          set({
            checklist: get().checklist.map((item) =>
              item.docType === docType
                ? { ...item, uploadStatus: "uploaded", fileId: doc.id, fileName: doc.file_name, rejectionReason: null }
                : item,
            ),
            uploads: { ...get().uploads, [docType]: { status: "idle", progress: 100 } },
            uploadedDocs: { ...get().uploadedDocs, [docType]: doc },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          set({
            uploads: {
              ...get().uploads,
              [docType]: { status: "error", progress: 0, errorMessage: message },
            },
          });
        }
      },

      removeDocument: (docType) =>
        set({
          checklist: get().checklist.map((item) =>
            item.docType === docType
              ? { ...item, uploadStatus: "not_started", fileId: null, fileName: null }
              : item,
          ),
          uploadedDocs: Object.fromEntries(
            Object.entries(get().uploadedDocs).filter(([k]) => k !== docType),
          ),
        }),

      setPreview: (docType) => set({ previewing: docType }),
    }),
    { name: "origina-documents" },
  ),
);
