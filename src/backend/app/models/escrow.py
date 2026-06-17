from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class EscrowDetail(TenantMixin, Base):
    __tablename__ = "escrow_details"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)

    company_name: Mapped[str | None] = mapped_column(String)
    officer_name: Mapped[str | None] = mapped_column(String)
    officer_email: Mapped[str | None] = mapped_column(String)
    officer_phone: Mapped[str | None] = mapped_column(String)
    company_address: Mapped[str | None] = mapped_column(String)

    escrow_number: Mapped[str | None] = mapped_column(String)
    contract_date: Mapped[date | None] = mapped_column(Date)
    closing_date: Mapped[date | None] = mapped_column(Date)
    settlement_agent: Mapped[str | None] = mapped_column(String)
    earnest_money_deposit: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    wire_instructions_status: Mapped[str | None] = mapped_column(String, server_default="pending")

    estimated_cash_to_close: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    verified_cash_to_close: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    seller_credits: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    lender_credits: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    third_party_fees: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    escrow_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    closing_protection_letter: Mapped[bool] = mapped_column(Boolean, server_default="false")
    settlement_stmt_reviewed: Mapped[bool] = mapped_column(Boolean, server_default="false")
    wire_verified: Mapped[bool] = mapped_column(Boolean, server_default="false")

    notes: Mapped[str | None] = mapped_column(String)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="escrow")
