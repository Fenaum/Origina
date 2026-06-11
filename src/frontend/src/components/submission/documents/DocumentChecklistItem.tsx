import { useRef } from "react";
import { useDocumentStore } from "@/state/documentStore";
import { useLoanSubmissionStore } from "@/state/submissionStore";
import type { DocumentChecklistItem as Item } from "@/types/submission";

export function DocumentChecklistItem({ item }: { item: Item }) {
  const inputRef    = useRef<HTMLInputElement | null>(null);
  const loanId      = useLoanSubmissionStore((state) => state.draft.loanId);
  const uploadDocument = useDocumentStore((state) => state.uploadDocument);
  const removeDocument = useDocumentStore((state) => state.removeDocument);
  const setPreview     = useDocumentStore((state) => state.setPreview);
  const uploadState    = useDocumentStore((state) => state.uploads[item.docType]);

  const isUploading = uploadState?.status === "uploading";
  const hasError    = uploadState?.status === "error";

  return (
    <article className="document-card">
      <div>
        <small>{item.requirement.replace("_", " ").toUpperCase()}</small>
        <h3>{item.label}</h3>
        <p>{item.description}</p>
        {item.conditionReason ? <span>{item.conditionReason}</span> : null}
      </div>

      {item.fileName ? (
        <div className="uploaded-document">
          <strong>{item.fileName}</strong>
          <div>
            <button className="ghost-button" type="button" onClick={() => setPreview(item.docType)}>
              Preview
            </button>
            <button className="ghost-button" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
              Replace
            </button>
            <button className="ghost-button" type="button" onClick={() => removeDocument(item.docType)} disabled={isUploading}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className="upload-zone"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? "Uploading…" : "Drop file here or click to upload"}
        </button>
      )}

      {hasError && uploadState?.errorMessage && (
        <p className="document-upload-error">{uploadState.errorMessage}</p>
      )}

      <input
        hidden
        ref={inputRef}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadDocument(item.docType, file, loanId);
          // Reset value so the same file can be re-selected after a Remove.
          event.target.value = "";
        }}
      />
      <span className={`document-status ${item.uploadStatus}`}>
        {isUploading ? "uploading…" : item.uploadStatus.replace("_", " ")}
      </span>
    </article>
  );
}
