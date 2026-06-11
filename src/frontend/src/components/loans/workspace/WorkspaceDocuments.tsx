import { useMemo, useState } from "react";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

type DocumentCategory =
  | "Income"
  | "Assets"
  | "Credit"
  | "Property"
  | "Disclosures"
  | "Conditions"
  | "Closing"
  | "Miscellaneous";

type WorkspaceDocument = {
  id: string;
  fileName: string;
  category: DocumentCategory;
  documentType: string;
  version: string;
  status: "Uploaded" | "Reviewed" | "Needs Review" | "Archived";
  uploadedBy: string;
  uploadedAt: string;
  linkedCondition: string | null;
  size: string;
  mimeType: string;
  sha256: string;
};

const DOCUMENTS: WorkspaceDocument[] = [
  {
    id: "doc-1",
    fileName: "bank-statements-jan-mar.pdf",
    category: "Income",
    documentType: "Bank Statements",
    version: "v2",
    status: "Needs Review",
    uploadedBy: "Broker Portal",
    uploadedAt: "2026-06-02",
    linkedCondition: "INC-004",
    size: "2.8 MB",
    mimeType: "application/pdf",
    sha256: "a90c...129f",
  },
  {
    id: "doc-2",
    fileName: "purchase-contract.pdf",
    category: "Property",
    documentType: "Purchase Contract",
    version: "v1",
    status: "Reviewed",
    uploadedBy: "Account Manager",
    uploadedAt: "2026-06-03",
    linkedCondition: null,
    size: "1.1 MB",
    mimeType: "application/pdf",
    sha256: "d44b...84ad",
  },
  {
    id: "doc-3",
    fileName: "asset-statement-vanguard.pdf",
    category: "Assets",
    documentType: "Asset Statement",
    version: "v1",
    status: "Uploaded",
    uploadedBy: "Borrower",
    uploadedAt: "2026-06-04",
    linkedCondition: null,
    size: "940 KB",
    mimeType: "application/pdf",
    sha256: "c118...aa02",
  },
  {
    id: "doc-4",
    fileName: "initial-disclosures-signed.pdf",
    category: "Disclosures",
    documentType: "Signed Disclosure Package",
    version: "v1",
    status: "Reviewed",
    uploadedBy: "Disclosure Desk",
    uploadedAt: "2026-06-05",
    linkedCondition: null,
    size: "4.2 MB",
    mimeType: "application/pdf",
    sha256: "00ab...72e1",
  },
];

const CATEGORIES: DocumentCategory[] = [
  "Income",
  "Assets",
  "Credit",
  "Property",
  "Disclosures",
  "Conditions",
  "Closing",
  "Miscellaneous",
];

export function WorkspaceDocuments({ loan }: Props) {
  const [category, setCategory] = useState<DocumentCategory>("Income");
  const [selectedId, setSelectedId] = useState<string | null>(DOCUMENTS[0]?.id ?? null);
  const selected = DOCUMENTS.find((document) => document.id === selectedId) ?? null;
  const filtered = useMemo(
    () => DOCUMENTS.filter((document) => document.category === category),
    [category],
  );

  return (
    <div className="workspace-module workspace-module--full">
      <div className="workspace-section-header">
        <span>Loan File</span>
        <h2>Documents</h2>
        <p>Manage document categories, versions, condition links, metadata, and preview readiness for {loan.loanNumber}.</p>
      </div>

      <div className="documents-workspace">
        <aside className="documents-categories">
          <button type="button" className="documents-upload-button">Upload Document</button>
          {CATEGORIES.map((item) => {
            const count = DOCUMENTS.filter((document) => document.category === item).length;
            return (
              <button
                key={item}
                type="button"
                className={`documents-category${category === item ? " documents-category--active" : ""}`}
                onClick={() => {
                  setCategory(item);
                  setSelectedId(DOCUMENTS.find((document) => document.category === item)?.id ?? null);
                }}
              >
                <span>{item}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </aside>

        <section className="documents-grid-panel">
          <div className="documents-grid-header">
            <h3>{category}</h3>
            <div>
              <button type="button">Download</button>
              <button type="button">Link Condition</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="workspace-empty-state">
              <h3>No documents in this category</h3>
              <p>Upload documents here once the backend document queue is connected.</p>
            </div>
          ) : (
            <div className="documents-table">
              <div className="documents-table-row documents-table-row--head">
                <span>File</span>
                <span>Type</span>
                <span>Status</span>
                <span>Uploaded</span>
              </div>
              {filtered.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className={`documents-table-row${selectedId === document.id ? " documents-table-row--active" : ""}`}
                  onClick={() => setSelectedId(document.id)}
                >
                  <span>
                    <strong>{document.fileName}</strong>
                    <small>{document.version}</small>
                  </span>
                  <span>{document.documentType}</span>
                  <span><StatusPill label={document.status} /></span>
                  <span>{document.uploadedAt}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="documents-preview-panel">
          {selected ? (
            <>
              <div className="documents-preview-box">
                <span>Preview</span>
                <strong>{selected.mimeType === "application/pdf" ? "PDF viewer placeholder" : "Image preview placeholder"}</strong>
                <p>{selected.fileName}</p>
              </div>
              <div className="documents-metadata">
                <h3>Metadata</h3>
                <MetaLine label="Size" value={selected.size} />
                <MetaLine label="SHA256" value={selected.sha256} />
                <MetaLine label="Uploader" value={selected.uploadedBy} />
                <MetaLine label="Condition" value={selected.linkedCondition ?? "Not linked"} />
                <MetaLine label="OCR Status" value="Pending future processing" />
              </div>
            </>
          ) : (
            <div className="workspace-empty-state">
              <h3>Select a document</h3>
              <p>Preview and metadata will appear here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: WorkspaceDocument["status"] }) {
  const tone = label === "Reviewed" ? "success" : label === "Needs Review" ? "warning" : "neutral";
  return <span className={`workspace-pill workspace-pill--${tone}`}>{label}</span>;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="documents-meta-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
