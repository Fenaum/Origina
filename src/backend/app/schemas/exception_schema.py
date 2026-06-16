from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Exception ─────────────────────────────────────────────────────────────────

class ExceptionBase(BaseModel):
    exception_type: str
    title: str
    description: Optional[str] = None
    severity: Optional[str] = "medium"
    guideline_value: Optional[str] = None
    actual_value: Optional[str] = None
    variance: Optional[str] = None
    justification: Optional[str] = None
    compensating_factors: Optional[str] = None
    risk_factors: Optional[str] = None


class ExceptionCreate(ExceptionBase):
    loan_id: Optional[UUID] = None
    exception_source: Optional[str] = "loan_file"
    loan_snapshot: Optional[dict[str, Any]] = None


class ExceptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    guideline_value: Optional[str] = None
    actual_value: Optional[str] = None
    variance: Optional[str] = None
    justification: Optional[str] = None
    compensating_factors: Optional[str] = None
    risk_factors: Optional[str] = None


class ExceptionOut(ExceptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: Optional[UUID] = None
    exception_source: str
    status: str
    loan_snapshot: dict[str, Any]
    requested_by: Optional[UUID] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Decision actions ──────────────────────────────────────────────────────────

class DecisionRequest(BaseModel):
    reason: Optional[str] = None


# ── Exception events ──────────────────────────────────────────────────────────

class ExceptionEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    event_type: str
    actor_user_id: Optional[UUID] = None
    event_data: dict[str, Any]
    occurred_at: datetime


# ── Exception comments ────────────────────────────────────────────────────────

class ExceptionCommentCreate(BaseModel):
    body: str
    is_internal: Optional[bool] = False


class ExceptionCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    body: str
    created_by: Optional[UUID] = None
    is_internal: bool
    created_at: datetime


# ── Exception documents ───────────────────────────────────────────────────────

class ExceptionDocumentCreate(BaseModel):
    document_id: UUID


class ExceptionDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    document_id: UUID
    attached_by: Optional[UUID] = None
    attached_at: datetime


# ── Authority rules ───────────────────────────────────────────────────────────

class ExceptionAuthorityRuleCreate(BaseModel):
    exception_type: Optional[str] = None
    max_severity: Optional[str] = "critical"
    allowed_roles: Optional[list[str]] = None
    requires_dual_approval: Optional[bool] = False


class ExceptionAuthorityRuleUpdate(BaseModel):
    exception_type: Optional[str] = None
    max_severity: Optional[str] = None
    allowed_roles: Optional[list[str]] = None
    requires_dual_approval: Optional[bool] = None
    is_active: Optional[bool] = None


class ExceptionAuthorityRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_type: Optional[str] = None
    max_severity: str
    allowed_roles: list[str]
    requires_dual_approval: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
