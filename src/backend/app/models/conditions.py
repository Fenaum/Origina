"""Condition models for loan file requirements and underwriting follow-up.

Conditions are work items tied to a loan. They can be submitted, cleared,
waived, or rejected, and their resolution fields are intentionally explicit
because waivers and clearances have different compliance meaning.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.loan import Loan
    from app.models.user import User


class ConditionStatus:
    """
    Allowed values for conditions.status (TEXT + CHECK after migration 123).
    """
    OPEN      = "open"
    SUBMITTED = "submitted"
    CLEARED   = "cleared"
    WAIVED    = "waived"
    REJECTED  = "rejected"

    ALL: frozenset[str] = frozenset({"open", "submitted", "cleared", "waived", "rejected"})
    TERMINAL: frozenset[str] = frozenset({"cleared", "waived", "rejected"})


class Condition(BaseModel):
    __tablename__ = "conditions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','submitted','cleared','waived','rejected')",
            name="ck_condition_status",
        ),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    condition_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=ConditionStatus.OPEN,
    )

    # ── Resolution tracking (added in migration 102) ──────────────────────────
    # WHY two separate pairs instead of one generic "resolved_by/at":
    #   cleared = borrower submitted the required documents and they were accepted.
    #   waived  = the requirement was dropped without documentation (an exception).
    # These are legally distinct outcomes. A waiver requires separate underwriter
    # authority and must appear distinctly in compliance reports.
    cleared_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    waived_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    waived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    waive_reason: Mapped[str | None] = mapped_column(String)

    stage: Mapped[str] = mapped_column(String, nullable=False, server_default="prior_to_approval")

    loan: Mapped["Loan"] = relationship("Loan", back_populates="conditions")
    clearer: Mapped["User | None"] = relationship("User", foreign_keys=[cleared_by])
    waiver: Mapped["User | None"] = relationship("User", foreign_keys=[waived_by])
