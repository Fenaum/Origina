from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

# TYPE_CHECKING is False at runtime — these imports only exist for the type
# checker (Pyright/mypy). At runtime SQLAlchemy resolves the "Loan" / "User"
# strings itself. Using TYPE_CHECKING avoids circular imports while still
# giving the IDE full type information.
if TYPE_CHECKING:
    from app.models.loan import Loan
    from app.models.user import User


class ConditionStatus(str, Enum):
    OPEN = "open"
    SUBMITTED = "submitted"
    CLEARED = "cleared"
    WAIVED = "waived"
    REJECTED = "rejected"


class Condition(BaseModel):
    __tablename__ = "conditions"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    condition_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ConditionStatus] = mapped_column(
        # create_type=False: condition_status ENUM was created by 030_types.sql.
        # SQLAlchemy must not attempt to CREATE it again.
        ENUM(ConditionStatus, name="condition_status", values_callable=lambda e: [v.value for v in e], create_type=False),
        nullable=False,
        server_default=ConditionStatus.OPEN.value,
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

    loan: Mapped["Loan"] = relationship("Loan", back_populates="conditions")
    clearer: Mapped["User | None"] = relationship("User", foreign_keys=[cleared_by])
    waiver: Mapped["User | None"] = relationship("User", foreign_keys=[waived_by])
