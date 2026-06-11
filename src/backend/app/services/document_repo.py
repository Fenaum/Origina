"""Document repository — all DB operations for the documents table.

Every function enforces tenant_id scoping. Never return a document whose
tenant_id does not match the caller's tenant. Callers must not pass
tenant_id from request bodies — it must come from the authenticated user.

Soft-delete semantics:
  archive_document() sets archived_at + archived_by rather than issuing DELETE.
  list_documents() excludes archived rows by default (include_archived=False).
  Hard delete is not exposed to the API layer in Phase 1.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.document import Document


def create_document(
    db: Session,
    *,
    tenant_id: UUID,
    loan_id: UUID,
    uploaded_by: UUID | None,
    doc_type: str | None,
    file_name: str,
    mime_type: str | None,
    file_size_bytes: int | None,
    storage_key: str,
    sha256: str | None,
    tags: dict | None = None,
    condition_id: UUID | None = None,
) -> Document:
    doc = Document(
        tenant_id=tenant_id,
        loan_id=loan_id,
        uploaded_by=uploaded_by,
        doc_type=doc_type,
        file_name=file_name,
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
        storage_key=storage_key,
        sha256=sha256,
        tags=tags or {},
        condition_id=condition_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documents(
    db: Session,
    *,
    tenant_id: UUID,
    loan_id: UUID | None = None,
    condition_id: UUID | None = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:
    query = db.query(Document).filter(Document.tenant_id == tenant_id)
    if loan_id:
        query = query.filter(Document.loan_id == loan_id)
    if condition_id:
        query = query.filter(Document.condition_id == condition_id)
    if not include_archived:
        query = query.filter(Document.archived_at.is_(None))
    return (
        query
        .order_by(Document.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_document(
    db: Session,
    *,
    tenant_id: UUID,
    document_id: UUID,
) -> Document | None:
    doc = db.get(Document, document_id)
    if not doc or doc.tenant_id != tenant_id:
        return None
    return doc


def archive_document(
    db: Session,
    *,
    tenant_id: UUID,
    document_id: UUID,
    archived_by: UUID,
) -> Document | None:
    """Soft-delete a document. Sets archived_at/archived_by; does not remove the row or file."""
    doc = get_document(db, tenant_id=tenant_id, document_id=document_id)
    if not doc:
        return None
    if doc.archived_at is not None:
        return doc  # already archived — idempotent
    doc.archived_at = datetime.now(timezone.utc)
    doc.archived_by = archived_by
    db.commit()
    db.refresh(doc)
    return doc
