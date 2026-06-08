from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document_schema import DocumentCreate, DocumentOut
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Store document metadata. The actual file lives in S3 (storage_key is the object key)."""
    doc = Document(
        tenant_id=current_user.tenant_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude={"tenant_id", "uploaded_by"}),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/", response_model=list[DocumentOut])
def list_documents(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).filter(Document.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Document.loan_id == loan_id)
    return query.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit).all()


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc or doc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return None
