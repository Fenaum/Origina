from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Property(BaseModel):
    __tablename__ = "properties"

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

    # Extended fields added in migration 113
    county: Mapped[str | None] = mapped_column(String)
    census_tract: Mapped[str | None] = mapped_column(String)
    msa: Mapped[str | None] = mapped_column(String)
    apn: Mapped[str | None] = mapped_column(String)
    year_built: Mapped[int | None] = mapped_column(Integer)
    square_footage: Mapped[int | None] = mapped_column(Integer)
    lot_size_sqft: Mapped[int | None] = mapped_column(Integer)
    units: Mapped[int | None] = mapped_column(Integer)
    is_mixed_use: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    is_rural: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    is_condo_pud: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    flood_zone: Mapped[str | None] = mapped_column(String)
    flood_insurance_required: Mapped[bool | None] = mapped_column(Boolean)
    annual_taxes: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    hazard_insurance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    hoa_dues: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    value_source: Mapped[str | None] = mapped_column(String)
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    loan: Mapped["Loan"] = relationship("Loan", back_populates="properties")
