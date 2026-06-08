from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PricingRunCreate(BaseModel):
    loan_id: UUID
    tenant_id: UUID
    input_hash: str
    input_payload: Dict[str, Any]
    output_payload: Dict[str, Any]


class PricingRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    run_at: datetime
    run_by: Optional[UUID] = None
    input_hash: str
    input_payload: Dict[str, Any]
    output_payload: Dict[str, Any]


class EligibilityRunCreate(BaseModel):
    loan_id: UUID
    tenant_id: UUID
    input_hash: str
    input_payload: Dict[str, Any]
    output_payload: Dict[str, Any]


class EligibilityRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: UUID
    run_at: datetime
    run_by: Optional[UUID] = None
    input_hash: str
    input_payload: Dict[str, Any]
    output_payload: Dict[str, Any]
