from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TitleOrderBase(BaseModel):
    company_name: Optional[str] = None
    officer_name: Optional[str] = None
    officer_email: Optional[str] = None
    officer_phone: Optional[str] = None
    ordered_date: Optional[date] = None
    commitment_received_date: Optional[date] = None
    title_status: Optional[str] = None
    external_ref: Optional[str] = None
    borrower_vesting: Optional[str] = None
    ownership_type: Optional[str] = None
    entity_vesting: Optional[str] = None
    vesting_notes: Optional[str] = None
    cleared_date: Optional[date] = None
    funding_blocked: Optional[bool] = None
    funding_block_reason: Optional[str] = None
    legal_review_required: Optional[bool] = None
    legal_reviewer: Optional[str] = None
    legal_review_status: Optional[str] = None
    legal_review_notes: Optional[str] = None
    notes: Optional[str] = None


class TitleOrderCreate(TitleOrderBase):
    loan_id: UUID


class TitleOrderUpdate(TitleOrderBase):
    pass


class TitleOrderOut(TitleOrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    cleared_by: Optional[UUID] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    exceptions: list["TitleExceptionOut"] = []


class TitleExceptionBase(BaseModel):
    exception_type: str
    description: Optional[str] = None
    holder_name: Optional[str] = None
    amount: Optional[Decimal] = None
    exception_status: Optional[str] = None
    resolution: Optional[str] = None
    cleared_date: Optional[date] = None


class TitleExceptionCreate(TitleExceptionBase):
    loan_id: UUID
    title_order_id: Optional[UUID] = None


class TitleExceptionUpdate(BaseModel):
    description: Optional[str] = None
    holder_name: Optional[str] = None
    amount: Optional[Decimal] = None
    exception_status: Optional[str] = None
    resolution: Optional[str] = None
    cleared_date: Optional[date] = None


class TitleExceptionOut(TitleExceptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    title_order_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


TitleOrderOut.model_rebuild()
