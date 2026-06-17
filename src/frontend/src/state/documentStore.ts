/**
 * Document store — manages the upload checklist and document state.
 *
 * Upload flow:
 *   uploadDocument(docType, file, loanId) →
 *     POST /documents/upload (multipart/form-data)
 *     → sets checklist item to "uploaded" with real document ID from backend
 *
 * On mount, DocumentChecklist calls loadDocumentsForLoan(loanId) to restore
 * upload state from the DB (handles page reloads and returning visits).
 *
 * Token strategy: reads JWT from localStorage under the same key as auth.tsx.
 */

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
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
  // loanId this checklist belongs to — used to detect loan switches
  loanId: string | null;
  checklist: DocumentChecklistItem[];
  uploads: Record<string, UploadState>;
  previewing: string | null;
  uploadedDocs: Record<string, DocumentOut>;
  generateChecklist: (product: LoanProgram | null, borrowers?: BorrowerDraft[], loanId?: string | null) => void;
  loadDocumentsForLoan: (loanId: string) => Promise<void>;
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
    persist(
      (set, get) => ({
        loanId: null,
        checklist: generateDocumentChecklist(null),
        uploads: {},
        previewing: null,
        uploadedDocs: {},

        generateChecklist: (product, _borrowers, loanId) => {
          const fresh = generateDocumentChecklist(product);
          const state = get();

          // If switching to a different loan, start with a clean checklist.
          if (loanId && loanId !== state.loanId) {
            set({ checklist: fresh, loanId, uploadedDocs: {} });
            return;
          }

          // Same loan (or no loanId): merge fresh items with existing upload state
          // so navigation away and back doesn't wipe files the user already uploaded.
          const existing = state.checklist;
          const merged = fresh.map((item) => {
            const prev = existing.find((e) => e.docType === item.docType);
            return prev && prev.uploadStatus !== "not_started" ? prev : item;
          });
          set({ checklist: merged, loanId: loanId ?? state.loanId });
        },

        loadDocumentsForLoan: async (loanId) => {
          const token = getToken();
          if (!token || !loanId || loanId.startsWith("draft-")) return;

          try {
            const response = await fetch(
              `${API_BASE}/documents/?loan_id=${loanId}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!response.ok) return;

            const docs = await response.json() as DocumentOut[];

            // Build a docType → DocumentOut map for non-archived docs
            const byType: Record<string, DocumentOut> = {};
            for (const doc of docs) {
              if (!doc.archived_at && doc.doc_type) {
                byType[doc.doc_type] = doc;
              }
            }

            if (Object.keys(byType).length === 0) return;

            // Update checklist items that have a matching uploaded document
            set((state) => ({
              checklist: state.checklist.map((item) => {
                const doc = byType[item.docType];
                if (!doc) return item;
                return {
                  ...item,
                  uploadStatus: "uploaded" as const,
                  fileId: doc.id,
                  fileName: doc.file_name,
                  rejectionReason: null,
                };
              }),
              uploadedDocs: { ...state.uploadedDocs, ...byType },
            }));
          } catch {
            // Non-fatal — checklist just won't show server-side uploads
          }
        },

        uploadDocument: async (docType, file, loanId) => {
          const token = getToken();

          set((state) => ({
            uploads: {
              ...state.uploads,
              [docType]: { status: "uploading", progress: 0 },
            },
          }));

          // Fall back to mock when unauthenticated or loanId is not a real DB UUID.
          if (!token || !loanId || loanId.startsWith("draft-")) {
            await new Promise((res) => window.setTimeout(res, 260));
            set((state) => ({
              checklist: state.checklist.map((item) =>
                item.docType === docType
                  ? { ...item, uploadStatus: "uploaded", fileId: crypto.randomUUID(), fileName: file.name, rejectionReason: null }
                  : item,
              ),
              uploads: { ...state.uploads, [docType]: { status: "idle", progress: 100 } },
            }));
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

            set((state) => ({
              checklist: state.checklist.map((item) =>
                item.docType === docType
                  ? { ...item, uploadStatus: "uploaded", fileId: doc.id, fileName: doc.file_name, rejectionReason: null }
                  : item,
              ),
              uploads: { ...state.uploads, [docType]: { status: "idle", progress: 100 } },
              uploadedDocs: { ...state.uploadedDocs, [docType]: doc },
            }));
          } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed";
            set((state) => ({
              uploads: {
                ...state.uploads,
                [docType]: { status: "error", progress: 0, errorMessage: message },
              },
            }));
          }
        },

        removeDocument: (docType) =>
          set((state) => ({
            checklist: state.checklist.map((item) =>
              item.docType === docType
                ? { ...item, uploadStatus: "not_started", fileId: null, fileName: null }
                : item,
            ),
            uploadedDocs: Object.fromEntries(
              Object.entries(state.uploadedDocs).filter(([k]) => k !== docType),
            ),
          })),

        setPreview: (docType) => set({ previewing: docType }),
      }),
      {
        name: "origina.documents",
        storage: createJSONStorage(() => localStorage),
        // Don't persist in-flight upload state — only the checklist and uploaded docs
        partialize: (state) => ({
          loanId: state.loanId,
          checklist: state.checklist,
          uploadedDocs: state.uploadedDocs,
        }),
      },
    ),
    { name: "origina-documents" },
  ),
);
