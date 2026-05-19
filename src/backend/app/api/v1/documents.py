from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.document import Document
from app.schemas.document_schema import DocumentCreate, DocumentOut, DocumentUpdate


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)):
    # This stores document metadata only.
    # The actual file would usually live in S3 or another storage service.
    document = Document(**payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/", response_model=list[DocumentOut])
def list_documents(
    loan_id: UUID | None = None,
    tenant_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Document)

    if loan_id:
        query = query.filter(Document.loan_id == loan_id)
    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)

    return query.offset(skip).limit(limit).all()


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: UUID, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return document


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(document_id: UUID, payload: DocumentUpdate, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(document, field_name, value)

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: UUID, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    db.delete(document)
    db.commit()
    return None
