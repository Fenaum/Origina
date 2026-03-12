#Document Schema Python Schema
from typing import Any, Dict, Optional
from uuid import UUID   
from pydantic import BaseModel, Field #Importing BaseModel and Field from pydantic for data validation and model definition. BaseModel is the base class for creating data models, and Field is used to provide additional metadata and validation rules for model fields.

class DocumentBase(BaseModel): #Document Schema is for representing documents associated with loans. It includes fields for identifying the document, its type, and metadata. The flexible metadata field allows for storing additional information about the document without needing to change the schema structure.
    tenant_id: Optional[UUID] = None
    loan_id: Optional[UUID] = None
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    document_url: Optional[str] = None
    uploaded_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)  

