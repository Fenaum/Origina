from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, UUIDMixin


class AuditLog(TenantMixin, UUIDMixin, Base):
    __tablename__ = "audit_log"

    actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    reason: Mapped[str | None] = mapped_column(String)
    diff: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_user_id],
        back_populates="audit_events",
    )


class Snapshot(TenantMixin, UUIDMixin, Base):
    __tablename__ = "snapshots"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    snapshot_type: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String, nullable=False)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="snapshots")
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="snapshots",
    )
