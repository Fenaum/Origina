from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TenantMixin, UUIDMixin
from app.models.loan import LoanStatus


class ExceptionStatus(str, Enum):
    OPEN = "open"
    APPROVED = "approved"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"


class ExceptionSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# create_type=False on every ENUM column: these types were created by
# 030_types.sql. SQLAlchemy must not try to CREATE them a second time.
_EXCEPTION_STATUS = dict(name="exception_status", values_callable=lambda e: [v.value for v in e], create_type=False)
_EXCEPTION_SEVERITY = dict(name="exception_severity", values_callable=lambda e: [v.value for v in e], create_type=False)
_TASK_STATUS = dict(name="task_status", values_callable=lambda e: [v.value for v in e], create_type=False)
_TASK_PRIORITY = dict(name="task_priority", values_callable=lambda e: [v.value for v in e], create_type=False)
# loan_status is used by LoanStatusEvent but defined in loan.py — reuse that
# constant here. create_type=False is already set on both columns there.
_LOAN_STATUS = dict(name="loan_status", values_callable=lambda e: [v.value for v in e], create_type=False)


class LoanException(BaseModel):
    __tablename__ = "exceptions"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    exception_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ExceptionStatus] = mapped_column(
        ENUM(ExceptionStatus, **_EXCEPTION_STATUS),
        nullable=False,
        server_default=ExceptionStatus.OPEN.value,
    )
    severity: Mapped[ExceptionSeverity] = mapped_column(
        ENUM(ExceptionSeverity, **_EXCEPTION_SEVERITY),
        nullable=False,
        server_default=ExceptionSeverity.MEDIUM.value,
    )
    requested_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    decided_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    loan: Mapped["Loan"] = relationship("Loan", back_populates="exceptions")
    requester: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[requested_by],
        back_populates="requested_exceptions",
    )
    decider: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[decided_by],
        back_populates="decided_exceptions",
    )


class Task(BaseModel):
    __tablename__ = "tasks"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        ENUM(TaskStatus, **_TASK_STATUS),
        nullable=False,
        server_default=TaskStatus.TODO.value,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        ENUM(TaskPriority, **_TASK_PRIORITY),
        nullable=False,
        server_default=TaskPriority.NORMAL.value,
    )
    assigned_to: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="tasks")
    assignee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to],
        back_populates="assigned_tasks",
    )
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_tasks",
    )


class Note(TenantMixin, UUIDMixin, Base):
    # Notes are append-only — once written they should not be edited.
    # No updated_at by design: omitting it makes the immutability intent
    # visible in the schema. Use BaseModel only for mutable entities.
    __tablename__ = "notes"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="notes")
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_notes",
    )


class LoanStatusEvent(TenantMixin, UUIDMixin, Base):
    # Status events are immutable history records — never update them.
    # No updated_at for the same reason as Note above.
    __tablename__ = "loan_status_events"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[LoanStatus | None] = mapped_column(
        ENUM(LoanStatus, **_LOAN_STATUS),
    )
    to_status: Mapped[LoanStatus] = mapped_column(
        ENUM(LoanStatus, **_LOAN_STATUS),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(Text)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="status_events")
    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_user_id],
        back_populates="status_events",
    )
