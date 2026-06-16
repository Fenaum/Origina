from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class AppraisalOrder(TenantMixin, Base):
    __tablename__ = "appraisal_orders"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)

    ordered_date: Mapped[date | None] = mapped_column(Date)
    ordered_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    vendor_name: Mapped[str | None] = mapped_column(String)
    appraiser_name: Mapped[str | None] = mapped_column(String)
    external_ref: Mapped[str | None] = mapped_column(String)
    due_date: Mapped[date | None] = mapped_column(Date)
    inspection_date: Mapped[date | None] = mapped_column(Date)
    received_date: Mapped[date | None] = mapped_column(Date)

    appraised_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    appraisal_type: Mapped[str | None] = mapped_column(String)
    property_condition: Mapped[str | None] = mapped_column(String)

    review_status: Mapped[str | None] = mapped_column(String, server_default="pending")
    reviewed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    review_date: Mapped[date | None] = mapped_column(Date)
    has_rov: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    second_appraisal: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    review_notes: Mapped[str | None] = mapped_column(String)

    is_primary: Mapped[bool] = mapped_column(Boolean, server_default="false")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="appraisals")
