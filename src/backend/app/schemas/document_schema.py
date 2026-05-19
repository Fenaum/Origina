from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentBase(BaseModel):
    doc_type: Optional[str] = None
    file_name: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_key: str
    sha256: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    tags: Dict[str, Any] = Field(default_factory=dict)


class DocumentCreate(DocumentBase):
    tenant_id: UUID
    loan_id: UUID


class DocumentUpdate(BaseModel):
    doc_type: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_key: Optional[str] = None
    sha256: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    tags: Optional[Dict[str, Any]] = None


class DocumentOut(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    uploaded_at: datetime
