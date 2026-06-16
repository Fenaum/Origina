from datetime import datetime
from decimal import Decimal
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
    # Extended fields (migration 113)
    county: Optional[str] = None
    census_tract: Optional[str] = None
    msa: Optional[str] = None
    apn: Optional[str] = None
    year_built: Optional[int] = None
    square_footage: Optional[int] = None
    lot_size_sqft: Optional[int] = None
    units: Optional[int] = None
    is_mixed_use: Optional[bool] = None
    is_rural: Optional[bool] = None
    is_condo_pud: Optional[bool] = None
    flood_zone: Optional[str] = None
    flood_insurance_required: Optional[bool] = None
    annual_taxes: Optional[Decimal] = None
    hazard_insurance: Optional[Decimal] = None
    hoa_dues: Optional[Decimal] = None
    value_source: Optional[str] = None
    estimated_value: Optional[Decimal] = None


class PropertyCreate(PropertyBase):
    loan_id: UUID
    tenant_id: Optional[UUID] = None  # ignored; always derived from JWT


class PropertyUpdate(PropertyBase):
    pass


class PropertyOut(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    created_at: datetime
    updated_at: datetime
