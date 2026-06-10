from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IntakeAnswerIn(BaseModel):
    question_key: str
    value: str | int | float


class AnswerSavedOut(BaseModel):
    saved: bool


class IntakeSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class ProgramRecommendationOut(BaseModel):
    program_key: str
    rank: int
    match_strength: str
    title: str
    tagline: str
    rate_range_label: str
    doc_requirements: list[str]
    suitability_note: str
    disqualified: bool


class IntakeHandoffIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email_shape(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Invalid email address")
        return normalized


class HandoffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    handoff_id: UUID = Field(alias="id")
