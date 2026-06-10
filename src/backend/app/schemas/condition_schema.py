from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# stage values: prior_to_docs | prior_to_approval | prior_to_funding
VALID_STAGES = {"prior_to_docs", "prior_to_approval", "prior_to_funding"}


class ConditionBase(BaseModel):
    name: str
    description: Optional[str] = None
    condition_number: int
    status: Optional[str] = None
    stage: Optional[str] = "prior_to_approval"


class ConditionCreate(ConditionBase):
    loan_id: UUID


class ConditionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_number: Optional[int] = None
    status: Optional[str] = None
    stage: Optional[str] = None


class WaiveRequest(BaseModel):
    reason: Optional[str] = None


class ConditionOut(ConditionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    cleared_by: Optional[UUID] = None
    cleared_at: Optional[datetime] = None
    waived_by: Optional[UUID] = None
    waived_at: Optional[datetime] = None
    waive_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
