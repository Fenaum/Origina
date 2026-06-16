from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AppraisalOrderBase(BaseModel):
    ordered_date: Optional[date] = None
    vendor_name: Optional[str] = None
    appraiser_name: Optional[str] = None
    external_ref: Optional[str] = None
    due_date: Optional[date] = None
    inspection_date: Optional[date] = None
    received_date: Optional[date] = None
    appraised_value: Optional[Decimal] = None
    purchase_price: Optional[Decimal] = None
    appraisal_type: Optional[str] = None
    property_condition: Optional[str] = None
    review_status: Optional[str] = None
    review_date: Optional[date] = None
    has_rov: Optional[bool] = None
    second_appraisal: Optional[bool] = None
    review_notes: Optional[str] = None
    is_primary: Optional[bool] = None


class AppraisalOrderCreate(AppraisalOrderBase):
    loan_id: UUID


class AppraisalOrderUpdate(AppraisalOrderBase):
    pass


class AppraisalOrderOut(AppraisalOrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    ordered_by: Optional[UUID] = None
    reviewed_by: Optional[UUID] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
