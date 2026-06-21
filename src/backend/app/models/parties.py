from datetime import date

from sqlalchemy import CheckConstraint, Date, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PartyType:
    """Canonical party type codes. Matches controlled_values set 'party_type'."""
    PERSON  = "person"
    COMPANY = "company"

    ALL: frozenset[str] = frozenset({"person", "company"})


class Party(BaseModel):
    __tablename__ = "parties"

    __table_args__ = (
        CheckConstraint(
            "party_type IN ('person','company')",
            name="ck_party_type",
        ),
    )

    party_type:   Mapped[str] = mapped_column(String, nullable=False, server_default=PartyType.PERSON)
    display_name: Mapped[str] = mapped_column(String, nullable=False)

    # first_name/last_name apply to persons; legal_name applies to companies.
    # Both are nullable so the same table serves both party types without
    # having a separate column for every possible combination.
    first_name: Mapped[str | None] = mapped_column(String)
    last_name:  Mapped[str | None] = mapped_column(String)
    dob:        Mapped[date | None] = mapped_column(Date)
    legal_name: Mapped[str | None] = mapped_column(String)

    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)

    tenant:     Mapped["Tenant"] = relationship("Tenant", back_populates="parties")
    loans:      Mapped[list["LoanParty"]] = relationship("LoanParty", back_populates="party")
    user_links: Mapped[list["UserParty"]] = relationship("UserParty", back_populates="party")
