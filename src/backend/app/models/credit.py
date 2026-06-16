from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin


class CreditReport(TenantMixin, Base):
    __tablename__ = "credit_reports"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)

    report_date: Mapped[date | None] = mapped_column(Date)
    vendor: Mapped[str | None] = mapped_column(String)
    reference_number: Mapped[str | None] = mapped_column(String)
    external_ref: Mapped[str | None] = mapped_column(String)

    equifax_score: Mapped[int | None] = mapped_column(Integer)
    experian_score: Mapped[int | None] = mapped_column(Integer)
    transunion_score: Mapped[int | None] = mapped_column(Integer)
    middle_score: Mapped[int | None] = mapped_column(Integer)
    rep_score: Mapped[int | None] = mapped_column(Integer)

    is_active: Mapped[bool] = mapped_column(Boolean, server_default="false")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="credit_reports")
    liabilities: Mapped[list["CreditLiability"]] = relationship("CreditLiability", back_populates="report", cascade="all, delete-orphan")
    events: Mapped[list["CreditEvent"]] = relationship("CreditEvent", back_populates="report")


class CreditLiability(TenantMixin, Base):
    __tablename__ = "credit_liabilities"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    credit_report_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("credit_reports.id", ondelete="SET NULL"))

    tradeline_type: Mapped[str | None] = mapped_column(String)
    creditor_name: Mapped[str | None] = mapped_column(String)
    account_number_last4: Mapped[str | None] = mapped_column(String)
    balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    monthly_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    is_excluded: Mapped[bool] = mapped_column(Boolean, server_default="false")
    paid_at_closing: Mapped[bool] = mapped_column(Boolean, server_default="false")
    omit_reason: Mapped[str | None] = mapped_column(String)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    report: Mapped["CreditReport | None"] = relationship("CreditReport", back_populates="liabilities")


class CreditEvent(TenantMixin, Base):
    __tablename__ = "credit_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    loan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    credit_report_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("credit_reports.id", ondelete="SET NULL"))

    event_type: Mapped[str] = mapped_column(String, nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date)
    discharged_date: Mapped[date | None] = mapped_column(Date)
    months_since: Mapped[int | None] = mapped_column(Integer)
    explanation: Mapped[str | None] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    report: Mapped["CreditReport | None"] = relationship("CreditReport", back_populates="events")
