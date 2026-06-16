from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CreditReportBase(BaseModel):
    report_date: Optional[date] = None
    vendor: Optional[str] = None
    reference_number: Optional[str] = None
    external_ref: Optional[str] = None
    equifax_score: Optional[int] = None
    experian_score: Optional[int] = None
    transunion_score: Optional[int] = None
    middle_score: Optional[int] = None
    rep_score: Optional[int] = None
    is_active: Optional[bool] = None


class CreditReportCreate(CreditReportBase):
    loan_id: UUID


class CreditReportUpdate(CreditReportBase):
    pass


class CreditReportOut(CreditReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CreditLiabilityBase(BaseModel):
    tradeline_type: Optional[str] = None
    creditor_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    balance: Optional[Decimal] = None
    monthly_payment: Optional[Decimal] = None
    credit_limit: Optional[Decimal] = None
    is_excluded: Optional[bool] = None
    paid_at_closing: Optional[bool] = None
    omit_reason: Optional[str] = None


class CreditLiabilityCreate(CreditLiabilityBase):
    loan_id: UUID
    credit_report_id: Optional[UUID] = None


class CreditLiabilityUpdate(CreditLiabilityBase):
    pass


class CreditLiabilityOut(CreditLiabilityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    credit_report_id: Optional[UUID] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CreditEventBase(BaseModel):
    event_type: str
    event_date: Optional[date] = None
    discharged_date: Optional[date] = None
    months_since: Optional[int] = None
    explanation: Optional[str] = None


class CreditEventCreate(CreditEventBase):
    loan_id: UUID
    credit_report_id: Optional[UUID] = None


class CreditEventUpdate(BaseModel):
    event_date: Optional[date] = None
    discharged_date: Optional[date] = None
    months_since: Optional[int] = None
    explanation: Optional[str] = None


class CreditEventOut(CreditEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    credit_report_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
