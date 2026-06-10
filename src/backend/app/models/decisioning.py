"""Decisioning run models.

Pricing and eligibility runs are append-style records that preserve the input
payload, output payload, and runner metadata for later audit/replay. The live
pricing/AUS integrations can change, but these rows keep the historical result.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, UUIDMixin


class PricingRun(TenantMixin, UUIDMixin, Base):
    __tablename__ = "pricing_runs"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    run_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    input_hash: Mapped[str] = mapped_column(String, nullable=False)
    input_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    output_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="pricing_runs")
    runner: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[run_by],
        back_populates="pricing_runs",
    )


class EligibilityRun(TenantMixin, UUIDMixin, Base):
    __tablename__ = "eligibility_runs"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    run_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    input_hash: Mapped[str] = mapped_column(String, nullable=False)
    input_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    output_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="eligibility_runs")
    runner: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[run_by],
        back_populates="eligibility_runs",
    )
