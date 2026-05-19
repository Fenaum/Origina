from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AddressBase(BaseModel):
    street1: Optional[str] = None
    street2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class AddressCreate(AddressBase):
    tenant_id: UUID


class AddressOut(AddressBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


class BorrowerBase(BaseModel):
    type: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    ssn_last4: Optional[str] = None
    dob: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    current_address_id: Optional[UUID] = None
    mailing_address_id: Optional[UUID] = None
    relationship: Optional[str] = None
    income_type: Optional[str] = None
    income_amount: Optional[Decimal] = None
    ethnicity: Optional[str] = None
    race: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    dependents: Optional[int] = None
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    job_title: Optional[str] = None
    years_on_job: Optional[int] = None
    years_in_profession: Optional[int] = None
    work_phone: Optional[str] = None
    work_email: Optional[str] = None


class BorrowerCreate(BorrowerBase):
    tenant_id: UUID
    loan_id: UUID
    ssn_encrypted: Optional[bytes] = None


class BorrowerUpdate(BaseModel):
    type: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    ssn_last4: Optional[str] = None
    ssn_encrypted: Optional[bytes] = None
    dob: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    current_address_id: Optional[UUID] = None
    mailing_address_id: Optional[UUID] = None
    relationship: Optional[str] = None
    income_type: Optional[str] = None
    income_amount: Optional[Decimal] = None
    ethnicity: Optional[str] = None
    race: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    dependents: Optional[int] = None
    employment_status: Optional[str] = None
    employer_name: Optional[str] = None
    job_title: Optional[str] = None
    years_on_job: Optional[int] = None
    years_in_profession: Optional[int] = None
    work_phone: Optional[str] = None
    work_email: Optional[str] = None


class BorrowerOut(BorrowerBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    created_at: datetime
    updated_at: datetime
