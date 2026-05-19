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

    party_type: Mapped[PartyType] = mapped_column(
        # party_type ENUM was created by 030_types.sql.
        # create_type=False tells SQLAlchemy not to try creating it again.
        ENUM(PartyType, name="party_type", values_callable=lambda e: [v.value for v in e], create_type=False),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String, nullable=False)

    # first_name/last_name apply to persons; legal_name applies to companies.
    # Both are nullable so the same table serves both party types without
    # having a separate column for every possible combination.
    first_name: Mapped[str | None] = mapped_column(String)
    last_name: Mapped[str | None] = mapped_column(String)
    dob: Mapped[date | None] = mapped_column(Date)
    legal_name: Mapped[str | None] = mapped_column(String)

    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="parties")
    loans: Mapped[list["LoanParty"]] = relationship("LoanParty", back_populates="party")
    user_links: Mapped[list["UserParty"]] = relationship("UserParty", back_populates="party")
