import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { generateDocumentChecklist } from "@/data/submissionConfig";
import type {
  BorrowerDraft,
  DocumentChecklistItem,
  LoanProgram,
} from "@/types/submission";

type UploadState = {
  status: "idle" | "uploading" | "error";
  progress: number;
};

type DocumentStore = {
  checklist: DocumentChecklistItem[];
  uploads: Record<string, UploadState>;
  previewing: string | null;
  generateChecklist: (product: LoanProgram | null, borrowers: BorrowerDraft[]) => void;
  uploadDocument: (docType: string, file: File) => Promise<void>;
  removeDocument: (docType: string) => void;
  setPreview: (docType: string | null) => void;
};

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    (set, get) => ({
      checklist: generateDocumentChecklist(null),
      uploads: {},
      previewing: null,
      generateChecklist: (product) =>
        set({ checklist: generateDocumentChecklist(product) }),
      uploadDocument: async (docType, file) => {
        set({
          uploads: {
            ...get().uploads,
            [docType]: { status: "uploading", progress: 35 },
          },
        });

        await new Promise((resolve) => window.setTimeout(resolve, 260));

        set({
          checklist: get().checklist.map((item) =>
            item.docType === docType
              ? {
                  ...item,
                  uploadStatus: "uploaded",
                  fileId: crypto.randomUUID(),
                  fileName: file.name,
                  rejectionReason: null,
                }
              : item,
          ),
          uploads: {
            ...get().uploads,
            [docType]: { status: "idle", progress: 100 },
          },
        });
      },
      removeDocument: (docType) =>
        set({
          checklist: get().checklist.map((item) =>
            item.docType === docType
              ? {
                  ...item,
                  uploadStatus: "not_started",
                  fileId: null,
                  fileName: null,
                }
              : item,
          ),
        }),
      setPreview: (docType) => set({ previewing: docType }),
    }),
    { name: "origina-documents" },
  ),
);
