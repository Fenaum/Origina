from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    loan_id: UUID
    doc_type: Optional[str] = None
    file_name: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_key: str
    sha256: Optional[str] = None
    tags: Dict[str, Any] = Field(default_factory=dict)
    # tenant_id and uploaded_by are injected from auth — never from the client


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    doc_type: Optional[str] = None
    file_name: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_key: str
    sha256: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    uploaded_at: datetime
    tags: Dict[str, Any]
