from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AppendOnlyModel, Base, UUIDMixin


class IntakeSession(AppendOnlyModel):
    __tablename__ = "intake_sessions"

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)

    answers: Mapped[list["IntakeAnswer"]] = relationship(
        "IntakeAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    handoffs: Mapped[list["IntakeHandoff"]] = relationship(
        "IntakeHandoff",
        back_populates="session",
    )


class IntakeAnswer(UUIDMixin, Base):
    __tablename__ = "intake_answers"
    __table_args__ = (UniqueConstraint("session_id", "question_key"),)

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("intake_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_key: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    session: Mapped[IntakeSession] = relationship("IntakeSession", back_populates="answers")


class IntakeHandoff(UUIDMixin, Base):
    __tablename__ = "intake_handoffs"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("intake_sessions.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[str | None] = mapped_column(Text)

    session: Mapped[IntakeSession] = relationship("IntakeSession", back_populates="handoffs")
