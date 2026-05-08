from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PartyBase(BaseModel):
    party_type: str
    display_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    legal_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PartyCreate(PartyBase):
    tenant_id: UUID


class PartyUpdate(BaseModel):
    party_type: Optional[str] = None
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    legal_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PartyOut(PartyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
