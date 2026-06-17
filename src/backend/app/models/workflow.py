from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TenantMixin, UUIDMixin
from app.models.loan import LoanStatus


class ExceptionStatus:
    """
    Allowed values for exceptions.status (TEXT column with ck_exception_status CHECK).
    Use these constants in service-layer comparisons instead of raw strings.
    See migration 119_exceptions_stabilize.sql for the CHECK constraint definition.
    """
    OPEN = "open"                              # legacy: pre-workflow exceptions
    DRAFT = "draft"                            # created, not yet submitted
    SUBMITTED = "submitted"                    # in the approver queue
    ASSIGNED = "assigned"                      # assigned to a specific approver
    UNDER_REVIEW = "under_review"              # approver actively reviewing
    ADDITIONAL_INFO_REQUESTED = "additional_info_requested"
    APPROVED = "approved"                      # approved as requested
    APPROVED_WITH_CONDITIONS = "approved_with_conditions"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"                          # legacy terminal state

    # Grouped sets for state-machine checks in the service layer
    TERMINAL: frozenset[str] = frozenset({
        "approved", "approved_with_conditions", "denied", "withdrawn", "closed"
    })
    ACTIONABLE: frozenset[str] = frozenset({
        "open", "submitted", "under_review", "additional_info_requested"
    })


class ExceptionSeverity:
    """
    Allowed values for exceptions.severity (TEXT column with ck_exception_severity CHECK).
    See migration 119_exceptions_stabilize.sql for the CHECK constraint definition.
    """
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    ALL: frozenset[str] = frozenset({"low", "medium", "high", "critical"})


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
# _EXCEPTION_STATUS and _EXCEPTION_SEVERITY are intentionally absent:
# those columns are now TEXT + CHECK (migration 119_exceptions_stabilize.sql).
_TASK_STATUS = dict(name="task_status", values_callable=lambda e: [v.value for v in e], create_type=False)
_TASK_PRIORITY = dict(name="task_priority", values_callable=lambda e: [v.value for v in e], create_type=False)
_LOAN_STATUS = dict(name="loan_status", values_callable=lambda e: [v.value for v in e], create_type=False)


class LoanException(BaseModel):
    __tablename__ = "exceptions"
    __table_args__ = (
        # Mirrors ck_exception_status CHECK in 119_exceptions_stabilize.sql.
        # Declarative only — create_all() is not used; the migration enforces this.
        CheckConstraint(
            "status IN ('open','draft','submitted','assigned','under_review',"
            "'additional_info_requested','approved','approved_with_conditions',"
            "'denied','withdrawn','closed')",
            name="ck_exception_status",
        ),
        CheckConstraint(
            "severity IN ('low','medium','high','critical')",
            name="ck_exception_severity",
        ),
    )

    # Nullable: pre-file exceptions exist before any loan is created
    loan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=True,
    )
    exception_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=ExceptionStatus.OPEN,
    )
    severity: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=ExceptionSeverity.MEDIUM,
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

    # ── Underwriting analysis fields (added in migration 118) ─────────────────
    guideline_value: Mapped[str | None] = mapped_column(Text)
    actual_value: Mapped[str | None] = mapped_column(Text)
    variance: Mapped[str | None] = mapped_column(Text)
    justification: Mapped[str | None] = mapped_column(Text)
    # ── Structured factor arrays (migration 120) ──────────────────────────────
    # JSONB arrays of {code: str, notes: str|null} objects.
    # Replaces the old TEXT columns. See exception_schema.py for allowed codes.
    compensating_factors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="[]",
    )
    risk_factors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="[]",
    )
    loan_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
    )
    loan_snapshot_hash: Mapped[str | None] = mapped_column(String)

    # ── Classification fields (migration 120) ─────────────────────────────────
    # 'pre_file' | 'loan_file' (legacy — use context_type for new code)
    exception_source: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default="loan_file",
    )
    # context_type supersedes exception_source with a richer controlled vocabulary
    context_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default="loan_file",
    )
    primary_category: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default="other",
    )
    reason_code: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default="other",
    )
    related_categories: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="[]",
    )

    # ── Workflow assignment (migration 120) ───────────────────────────────────
    assigned_to: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ── Structured numeric metrics (migration 120) ────────────────────────────
    # Parallel to guideline_value/actual_value TEXT display fields.
    # Use these for reporting queries (variance thresholds, aggregations).
    metric_type: Mapped[str | None] = mapped_column(String)
    guideline_operator: Mapped[str | None] = mapped_column(String)
    metric_guideline: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    metric_actual: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    metric_variance: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    metric_variance_unit: Mapped[str | None] = mapped_column(String)

    loan: Mapped["Loan | None"] = relationship("Loan", back_populates="exceptions")
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
    events: Mapped[list["ExceptionEvent"]] = relationship(
        "ExceptionEvent",
        back_populates="exception",
        cascade="all, delete-orphan",
        order_by="ExceptionEvent.occurred_at",
    )
    comments: Mapped[list["ExceptionComment"]] = relationship(
        "ExceptionComment",
        back_populates="exception",
        cascade="all, delete-orphan",
        order_by="ExceptionComment.created_at",
    )
    document_links: Mapped[list["ExceptionDocument"]] = relationship(
        "ExceptionDocument",
        back_populates="exception",
        cascade="all, delete-orphan",
    )
    assigned_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to],
    )


class ExceptionEvent(TenantMixin, UUIDMixin, Base):
    """Immutable audit trail for an exception. Never update these rows."""
    __tablename__ = "exception_events"

    exception_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("exceptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    event_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    exception: Mapped[LoanException] = relationship("LoanException", back_populates="events")
    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_user_id],
        back_populates="exception_events_authored",
    )


class ExceptionComment(TenantMixin, UUIDMixin, Base):
    """Immutable comment thread entry. Never update these rows."""
    __tablename__ = "exception_comments"

    exception_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("exceptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    exception: Mapped[LoanException] = relationship("LoanException", back_populates="comments")
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="exception_comments_authored",
    )


class ExceptionDocument(TenantMixin, UUIDMixin, Base):
    """Junction table linking exceptions to uploaded documents."""
    __tablename__ = "exception_documents"

    exception_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("exceptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    attached_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    attached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    exception: Mapped[LoanException] = relationship("LoanException", back_populates="document_links")
    document: Mapped["Document"] = relationship("Document")
    attacher: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[attached_by],
    )


class ExceptionAuthorityRule(TenantMixin, UUIDMixin, Base):
    """
    Tenant-configurable approval authority matrix.
    Defines which roles may approve which exception types at which severity levels.
    exception_type NULL = rule applies to all exception types.
    """
    __tablename__ = "exception_authority_rules"

    exception_type: Mapped[str | None] = mapped_column(String)
    max_severity: Mapped[str] = mapped_column(String, nullable=False, server_default="critical")
    allowed_roles: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        server_default='["underwriter","account_manager","it_admin"]',
    )
    requires_dual_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
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
