import { useEffect, useMemo, useRef, useState } from "react";
import {
  archiveDocument,
  buildDocumentDownloadUrl,
  listDocuments,
  uploadDocument,
} from "@/services/documentsService";
import { useAuth } from "@/state/auth";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { LoanSummary } from "@/types/loan";
import type { DocumentOut } from "@/types/api";

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

function categoryFor(docType: string | null): DocumentCategory {
  const t = (docType ?? "").toLowerCase();
  if (t.includes("bank") || t.includes("income") || t.includes("w2") || t.includes("paystub")) return "Income";
  if (t.includes("asset") || t.includes("vanguard") || t.includes("statement")) return "Assets";
  if (t.includes("credit") || t.includes("tri") || t.includes("fico")) return "Credit";
  if (t.includes("appraisal") || t.includes("purchase") || t.includes("contract")) return "Property";
  if (t.includes("disclosure")) return "Disclosures";
  if (t.includes("condition")) return "Conditions";
  if (t.includes("closing") || t.includes("title") || t.includes("hud")) return "Closing";
  return "Miscellaneous";
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function WorkspaceDocuments({ loan }: Props) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocumentCategory>("Income");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDocuments() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listDocuments(loan.id, token);
      setDocuments(data);
      if (data.length > 0 && !data.find((d) => d.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan.id, token]);

  const filtered = useMemo(
    () => documents.filter((doc) => categoryFor(doc.doc_type) === category),
    [documents, category],
  );

  const selected = documents.find((d) => d.id === selectedId) ?? null;

  const counts: Record<DocumentCategory, number> = useMemo(() => {
    const result = {} as Record<DocumentCategory, number>;
    for (const cat of CATEGORIES) result[cat] = 0;
    for (const doc of documents) {
      const cat = categoryFor(doc.doc_type);
      result[cat] = (result[cat] ?? 0) + 1;
    }
    return result;
  }, [documents]);

  async function handleUploadClick() {
    setUploadError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChosen(file: File | null | undefined) {
    if (!file || !token) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(
        loan.id,
        file,
        { docType: uploadType || undefined },
        token,
      );
      setUploadType("");
      setUploadOpen(false);
      await fetchDocuments();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleArchive(docId: string) {
    if (!token) return;
    setArchiveError(null);
    try {
      await archiveDocument(docId, token);
      if (selectedId === docId) setSelectedId(null);
      await fetchDocuments();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="workspace-module workspace-module--full">
      <div className="workspace-section-header">
        <span>Loan File</span>
        <h2>Documents</h2>
        <p>Manage document categories, versions, condition links, metadata, and preview readiness for {loan.loanNumber}.</p>
      </div>

      <div className="documents-workspace">
        <aside className="documents-categories">
          <button type="button" className="documents-upload-button" onClick={() => setUploadOpen((v) => !v)}>
            Upload Document
          </button>
          {uploadOpen && (
            <div className="documents-upload-form">
              <input
                className="documents-upload-input"
                placeholder="Document type (e.g. bank_statement)"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="documents-upload-input"
                onChange={(e) => void handleFileChosen(e.target.files?.[0])}
                disabled={uploading}
              />
              {uploadError && <div className="documents-upload-error">{uploadError}</div>}
            </div>
          )}
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`documents-category${category === item ? " documents-category--active" : ""}`}
              onClick={() => {
                setCategory(item);
                const first = documents.find((doc) => categoryFor(doc.doc_type) === item);
                setSelectedId(first?.id ?? null);
              }}
            >
              <span>{item}</span>
              <strong>{counts[item] ?? 0}</strong>
            </button>
          ))}
        </aside>

        <section className="documents-grid-panel">
          <div className="documents-grid-header">
            <h3>{category}</h3>
            <div>
              <button type="button" onClick={handleUploadClick} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {loading && (
            <div className="workspace-skeleton documents-skeleton" aria-hidden>
              <div className="documents-skeleton-row" />
              <div className="documents-skeleton-row" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <EmptyState
              title={`No documents in ${category}`}
              description="Use the upload form in the left rail to attach a file to this loan."
            />
          )}

          {!loading && filtered.length > 0 && (
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
                    <strong>{document.file_name}</strong>
                    <small>{formatBytes(document.file_size_bytes)}</small>
                  </span>
                  <span>{document.doc_type ?? "—"}</span>
                  <span><StatusPill status="Uploaded" /></span>
                  <span>{formatDateTime(document.uploaded_at)}</span>
                </button>
              ))}
            </div>
          )}

          {archiveError && <div className="documents-upload-error">{archiveError}</div>}
        </section>

        <aside className="documents-preview-panel">
          {selected ? (
            <>
              <div className="documents-preview-box">
                <span>Preview</span>
                <strong>{selected.mime_type === "application/pdf" ? "PDF viewer placeholder" : "File preview placeholder"}</strong>
                <p>{selected.file_name}</p>
                <a
                  href={buildDocumentDownloadUrl(selected.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="workspace-primary-button documents-download-link"
                >
                  Download
                </a>
              </div>
              <div className="documents-metadata">
                <h3>Metadata</h3>
                <MetaLine label="Size" value={formatBytes(selected.file_size_bytes)} />
                <MetaLine label="SHA256" value={selected.sha256 ? `${selected.sha256.slice(0, 12)}…` : "—"} />
                <MetaLine label="MIME" value={selected.mime_type ?? "—"} />
                <MetaLine label="Uploader" value={selected.uploaded_by ?? "—"} />
                <MetaLine label="Condition" value={selected.condition_id ?? "Not linked"} />
                <button
                  type="button"
                  className="documents-archive-button"
                  onClick={() => void handleArchive(selected.id)}
                >
                  Archive
                </button>
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

function StatusPill({ status }: { status: string }) {
  const tone = status === "Reviewed" ? "success" : status === "Needs Review" ? "warning" : "neutral";
  return <span className={`workspace-pill workspace-pill--${tone}`}>{status}</span>;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="documents-meta-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
