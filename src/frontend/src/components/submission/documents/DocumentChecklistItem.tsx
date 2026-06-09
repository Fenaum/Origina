import { useRef } from "react";
import { useDocumentStore } from "@/state/documentStore";
import type { DocumentChecklistItem as Item } from "@/types/submission";

export function DocumentChecklistItem({ item }: { item: Item }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadDocument = useDocumentStore((state) => state.uploadDocument);
  const removeDocument = useDocumentStore((state) => state.removeDocument);
  const setPreview = useDocumentStore((state) => state.setPreview);

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
            <button className="ghost-button" type="button" onClick={() => inputRef.current?.click()}>
              Replace
            </button>
            <button className="ghost-button" type="button" onClick={() => removeDocument(item.docType)}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button className="upload-zone" type="button" onClick={() => inputRef.current?.click()}>
          Drop file here or click to upload
        </button>
      )}
      <input
        hidden
        ref={inputRef}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadDocument(item.docType, file);
        }}
      />
      <span className={`document-status ${item.uploadStatus}`}>{item.uploadStatus.replace("_", " ")}</span>
    </article>
  );
}
