from enum import Enum
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class ConditionStatus(str, Enum):
    OPEN = "open"
    SUBMITTED = "submitted"
    CLEARED = "cleared"
    WAIVED = "waived"
    REJECTED = "rejected"


class Condition(BaseModel):
    __tablename__ = "conditions"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    condition_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ConditionStatus] = mapped_column(
        ENUM(ConditionStatus, name="condition_status", values_callable=lambda enum: [e.value for e in enum]),
        nullable=False,
        server_default=ConditionStatus.OPEN.value,
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="conditions")
