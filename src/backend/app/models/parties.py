from datetime import date
from enum import Enum

from sqlalchemy import Date, String
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PartyType(str, Enum):
    PERSON = "person"
    COMPANY = "company"


class Party(BaseModel):
    __tablename__ = "parties"

    # This matches the PostgreSQL enum created in 030_types.sql.
    party_type: Mapped[PartyType] = mapped_column(
        ENUM(PartyType, name="party_type", values_callable=lambda enum: [e.value for e in enum]),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String, nullable=False)

    first_name: Mapped[str | None] = mapped_column(String)
    last_name: Mapped[str | None] = mapped_column(String)
    dob: Mapped[date | None] = mapped_column(Date)

    legal_name: Mapped[str | None] = mapped_column(String)

    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="parties")
    loans: Mapped[list["LoanParty"]] = relationship("LoanParty", back_populates="party")
    user_links: Mapped[list["UserParty"]] = relationship("UserParty", back_populates="party")
