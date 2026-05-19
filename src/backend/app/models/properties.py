from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Property(BaseModel):
    __tablename__ = "properties"

    # Each property belongs to exactly one loan.
    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_subject: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    address1: Mapped[str | None] = mapped_column(String)
    address2: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    postal_code: Mapped[str | None] = mapped_column(String)
    property_type: Mapped[str | None] = mapped_column(String)
    occupancy: Mapped[str | None] = mapped_column(String)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="properties")
