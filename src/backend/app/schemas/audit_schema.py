from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    actor_user_id: Optional[UUID] = None
    entity_type: str
    entity_id: UUID
    action: str
    occurred_at: datetime
    reason: Optional[str] = None
    diff: Dict[str, Any]


class SnapshotCreate(BaseModel):
    loan_id: UUID
    tenant_id: UUID
    snapshot_type: str
    payload: Dict[str, Any]
    payload_hash: str


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    snapshot_type: str
    created_at: datetime
    created_by: Optional[UUID] = None
    payload: Dict[str, Any]
    payload_hash: str
