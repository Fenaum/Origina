# User Schema Python Schema
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field #Importing BaseModel and Field from pydantic for data validation and model definition. BaseModel is the base class for creating data models, and Field is used to provide additional metadata and validation rules for model fields.

class UserBase(BaseModel):
    tenant_id: Optional[UUID] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

