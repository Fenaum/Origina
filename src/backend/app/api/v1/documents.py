"""Document upload, listing, download, and archive endpoints.

Upload flow (POST /documents/upload):
  1. Validate file size and MIME type server-side (not trusting client headers).
  2. Compute SHA-256 of the raw bytes for integrity and deduplication.
  3. Generate a random path UUID and build a traversal-safe storage key.
  4. Write bytes to the configured StorageBackend (local in Phase 1, S3 in Phase 3).
  5. Store document metadata row in the DB via document_repo.

Download flow (GET /documents/{id}/download):
  Phase 1: reads bytes from local storage and streams them back.
  Phase 3 TODO: redirect to a short-lived presigned S3 URL instead.

Delete (DELETE /documents/{id}):
  Soft-archives the row (archived_at / archived_by). The storage key and file
  are not removed — full cleanup can be added in a background job later.

Security invariants:
  - tenant_id always comes from current_user, never from request body or URL.
  - Loan ownership is verified before any write (loan.tenant_id == current_user.tenant_id).
  - Storage backend prevents path traversal at both the key-construction and
    path-resolution levels.
  - File size is enforced after reading bytes (not from Content-Length header,
    which can be spoofed).
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_MB
from app.core.db import get_db
from app.models.loan import Loan
from app.models.user import User
from app.schemas.document_schema import DocumentCreate, DocumentOut
from app.security.security import get_audited_db, get_current_user
from app.services import document_repo
from app.services.storage_service import (
    compute_sha256,
    get_storage,
    make_storage_key,
    new_path_uuid,
)

router = APIRouter(prefix="/documents", tags=["documents"])

_MAX_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024


# ── Upload (multipart) ────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    loan_id: UUID = Form(...),
    doc_type: str = Form(None),
    condition_id: UUID = Form(None),
    tags: str = Form("{}"),
    file: UploadFile = File(...),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a document file and store its metadata.

    Accepts multipart/form-data with:
      - file        (required) — the binary file
      - loan_id     (required) — must belong to the authenticated tenant
      - doc_type    (optional) — e.g. "bank_statement", "paystub", "purchase_contract"
      - condition_id (optional) — link this upload to a specific condition
      - tags        (optional) — JSON object string, e.g. '{"month": "2024-01"}'
    """
    # ── Verify loan belongs to tenant ──────────────────────────────────────────
    loan = db.get(Loan, loan_id)
    if not loan or loan.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Loan not found")

    # ── Read file bytes ────────────────────────────────────────────────────────
    data = await file.read()

    # ── Enforce size limit (server-side, not from Content-Length) ─────────────
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_SIZE_MB} MB upload limit.",
        )

    # ── Validate MIME type ─────────────────────────────────────────────────────
    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{content_type}' is not allowed. "
                   f"Accepted types: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    # ── Parse tags (caller sends JSON string via form field) ───────────────────
    try:
        parsed_tags: dict = json.loads(tags) if tags and tags.strip() else {}
        if not isinstance(parsed_tags, dict):
            parsed_tags = {}
    except (json.JSONDecodeError, ValueError):
        parsed_tags = {}

    # ── Compute SHA-256 for integrity / deduplication ─────────────────────────
    sha = compute_sha256(data)

    # ── Build traversal-safe storage key and write to backend ─────────────────
    path_uuid   = new_path_uuid()
    storage_key = make_storage_key(
        str(current_user.tenant_id),
        str(loan_id),
        path_uuid,
        file.filename or "unnamed",
    )
    get_storage().put(storage_key, data)

    # ── Persist metadata row ───────────────────────────────────────────────────
    doc = document_repo.create_document(
        db,
        tenant_id=current_user.tenant_id,
        loan_id=loan_id,
        uploaded_by=current_user.id,
        doc_type=doc_type,
        file_name=file.filename or "unnamed",
        mime_type=content_type,
        file_size_bytes=len(data),
        storage_key=storage_key,
        sha256=sha,
        tags=parsed_tags,
        condition_id=condition_id,
    )
    return doc


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[DocumentOut])
def list_documents(
    loan_id: UUID | None = None,
    condition_id: UUID | None = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_repo.list_documents(
        db,
        tenant_id=current_user.tenant_id,
        loan_id=loan_id,
        condition_id=condition_id,
        include_archived=include_archived,
        skip=skip,
        limit=limit,
    )


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = document_repo.get_document(
        db, tenant_id=current_user.tenant_id, document_id=document_id
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream document bytes to the caller.

    Phase 1 (local): reads the file from disk and returns bytes directly.
    Phase 3 TODO: return a short-lived presigned S3 URL (RedirectResponse)
    so the download bypasses the API server entirely.
    """
    doc = document_repo.get_document(
        db, tenant_id=current_user.tenant_id, document_id=document_id
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.archived_at is not None:
        raise HTTPException(status_code=410, detail="Document has been archived")

    try:
        data = get_storage().get_bytes(doc.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in storage")

    safe_filename = doc.file_name.replace('"', '\\"')
    return Response(
        content=data,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Content-Length": str(len(data)),
            "X-SHA256": doc.sha256 or "",
        },
    )


# ── Archive (soft-delete) ─────────────────────────────────────────────────────

@router.delete("/{document_id}", status_code=status.HTTP_200_OK, response_model=DocumentOut)
def archive_document(
    document_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-archives a document (sets archived_at / archived_by).

    The row and file are retained for audit and recovery. Returns the updated
    document record. Use GET /documents/?include_archived=true to see archived rows.
    """
    doc = document_repo.archive_document(
        db,
        tenant_id=current_user.tenant_id,
        document_id=document_id,
        archived_by=current_user.id,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── Legacy metadata-only create (kept for internal use) ───────────────────────

@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document_metadata(
    payload: DocumentCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Store document metadata only (no file bytes).

    Kept for internal/tooling use where the file has already been placed in
    storage by another process. Prefer POST /documents/upload for end-user uploads.
    """
    return document_repo.create_document(
        db,
        tenant_id=current_user.tenant_id,
        loan_id=payload.loan_id,
        uploaded_by=current_user.id,
        doc_type=payload.doc_type,
        file_name=payload.file_name,
        mime_type=payload.mime_type,
        file_size_bytes=payload.file_size_bytes,
        storage_key=payload.storage_key,
        sha256=payload.sha256,
        tags=payload.tags,
        condition_id=payload.condition_id,
    )
