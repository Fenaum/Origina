from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PropertyBase(BaseModel):
    is_subject: Optional[bool] = True
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    property_type: Optional[str] = None
    occupancy: Optional[str] = None


class PropertyCreate(PropertyBase):
    loan_id: UUID
    tenant_id: UUID


class PropertyUpdate(PropertyBase):
    pass


class PropertyOut(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    created_at: datetime
    updated_at: datetime
