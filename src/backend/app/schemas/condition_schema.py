from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ConditionBase(BaseModel):
    name: str
    description: Optional[str] = None
    condition_number: int
    status: Optional[str] = None


class ConditionCreate(ConditionBase):
    loan_id: UUID


class ConditionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_number: Optional[int] = None
    status: Optional[str] = None


class ConditionOut(ConditionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    created_at: datetime
    updated_at: datetime
