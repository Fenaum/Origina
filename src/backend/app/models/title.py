from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class TitleOrder(TenantMixin, Base):
    __tablename__ = "title_orders"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)

    company_name: Mapped[str | None] = mapped_column(String)
    officer_name: Mapped[str | None] = mapped_column(String)
    officer_email: Mapped[str | None] = mapped_column(String)
    officer_phone: Mapped[str | None] = mapped_column(String)

    ordered_date: Mapped[date | None] = mapped_column(Date)
    commitment_received_date: Mapped[date | None] = mapped_column(Date)
    title_status: Mapped[str] = mapped_column(String, server_default="not_ordered")
    external_ref: Mapped[str | None] = mapped_column(String)

    borrower_vesting: Mapped[str | None] = mapped_column(String)
    ownership_type: Mapped[str | None] = mapped_column(String)
    entity_vesting: Mapped[str | None] = mapped_column(String)
    vesting_notes: Mapped[str | None] = mapped_column(String)

    cleared_date: Mapped[date | None] = mapped_column(Date)
    cleared_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    funding_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false")
    funding_block_reason: Mapped[str | None] = mapped_column(String)

    legal_review_required: Mapped[bool] = mapped_column(Boolean, server_default="false")
    legal_reviewer: Mapped[str | None] = mapped_column(String)
    legal_review_status: Mapped[str | None] = mapped_column(String)
    legal_review_notes: Mapped[str | None] = mapped_column(String)

    notes: Mapped[str | None] = mapped_column(String)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="title_orders")
    exceptions: Mapped[list["TitleException"]] = relationship("TitleException", back_populates="title_order", cascade="all, delete-orphan")


class TitleException(TenantMixin, Base):
    __tablename__ = "title_exceptions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    title_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("title_orders.id", ondelete="CASCADE"))

    exception_type: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    holder_name: Mapped[str | None] = mapped_column(String)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    exception_status: Mapped[str] = mapped_column(String, server_default="open")
    resolution: Mapped[str | None] = mapped_column(String)
    cleared_date: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    title_order: Mapped["TitleOrder | None"] = relationship("TitleOrder", back_populates="exceptions")
