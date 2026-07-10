from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Tasks ──────────────────────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "normal"
    assigned_to: Optional[UUID] = None
    due_at: Optional[datetime] = None


class TaskCreate(TaskBase):
    loan_id: UUID
    tenant_id: UUID


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[UUID] = None
    due_at: Optional[datetime] = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ── Notes ─────────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    loan_id: UUID
    # tenant_id is intentionally absent — the endpoint injects it from the
    # authenticated user's JWT. Clients must not send it. (Sprint 3 fix.)
    body: str


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    body: str
    created_by: Optional[UUID] = None
    created_at: datetime


# ── Exceptions ────────────────────────────────────────────────────────────────

class ExceptionBase(BaseModel):
    exception_type: str
    title: str
    description: Optional[str] = None
    status: Optional[str] = "open"
    severity: Optional[str] = "medium"


class ExceptionCreate(ExceptionBase):
    loan_id: UUID
    tenant_id: UUID


class ExceptionUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None


class ExceptionOut(ExceptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    requested_by: Optional[UUID] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Loan Status Events ─────────────────────────────────────────────────────────

class StatusEventCreate(BaseModel):
    to_status: str
    reason: Optional[str] = None


class StatusEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    actor_user_id: Optional[UUID] = None
    occurred_at: datetime
