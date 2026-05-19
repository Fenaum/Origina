from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, UUIDMixin


class Document(TenantMixin, UUIDMixin, Base):
    # WHY not BaseModel (which would add created_at + updated_at):
    #   Documents are immutable once uploaded. Renaming, re-tagging, or replacing
    #   a document should create a new row — not update an existing one. Having
    #   an updated_at column would imply the row is mutable, which is misleading.
    #   The field is named uploaded_at (not created_at) to make the semantic
    #   explicit: this is the moment of upload, not a generic row timestamp.
    #
    # WHY not AppendOnlyModel (which would give a created_at):
    #   uploaded_at is more descriptive than created_at for this domain.
    #   Keeping the name avoids a rename migration and keeps the API schema stable.
    __tablename__ = "documents"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    doc_type: Mapped[str | None] = mapped_column(String)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    # storage_key is the S3 object key (or equivalent). The application uses
    # this to retrieve the file — never store the full signed URL here because
    # signed URLs expire.
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    # sha256 enables deduplication: before storing, hash the file and check
    # if it already exists (idx_documents_sha index makes this fast).
    # Also used for integrity verification after retrieval.
    sha256: Mapped[str | None] = mapped_column(String)
    uploaded_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    tags: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    loan: Mapped["Loan"] = relationship("Loan", back_populates="documents")
    uploader: Mapped["User | None"] = relationship("User", back_populates="uploaded_documents")
