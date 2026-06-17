from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TenantMixin, TimestampMixin, UUIDMixin


class Tenant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="tenant")
    roles: Mapped[list["Role"]] = relationship("Role", back_populates="tenant")
    parties: Mapped[list["Party"]] = relationship("Party", back_populates="tenant")
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="tenant")


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email"),)

    email: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="users")
    roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user")
    party_links: Mapped[list["UserParty"]] = relationship("UserParty", back_populates="user")
    assigned_loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="assignee")
    uploaded_documents: Mapped[list["Document"]] = relationship(
        "Document",
        foreign_keys="Document.uploaded_by",
        back_populates="uploader",
    )
    requested_exceptions: Mapped[list["LoanException"]] = relationship(
        "LoanException",
        foreign_keys="LoanException.requested_by",
        back_populates="requester",
    )
    decided_exceptions: Mapped[list["LoanException"]] = relationship(
        "LoanException",
        foreign_keys="LoanException.decided_by",
        back_populates="decider",
    )
    exception_events_authored: Mapped[list["ExceptionEvent"]] = relationship(
        "ExceptionEvent",
        foreign_keys="ExceptionEvent.actor_user_id",
        back_populates="actor",
    )
    exception_comments_authored: Mapped[list["ExceptionComment"]] = relationship(
        "ExceptionComment",
        foreign_keys="ExceptionComment.created_by",
        back_populates="creator",
    )
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task",
        foreign_keys="Task.assigned_to",
        back_populates="assignee",
    )
    created_tasks: Mapped[list["Task"]] = relationship(
        "Task",
        foreign_keys="Task.created_by",
        back_populates="creator",
    )
    created_notes: Mapped[list["Note"]] = relationship(
        "Note",
        foreign_keys="Note.created_by",
        back_populates="creator",
    )
    status_events: Mapped[list["LoanStatusEvent"]] = relationship(
        "LoanStatusEvent",
        foreign_keys="LoanStatusEvent.actor_user_id",
        back_populates="actor",
    )
    pricing_runs: Mapped[list["PricingRun"]] = relationship(
        "PricingRun",
        foreign_keys="PricingRun.run_by",
        back_populates="runner",
    )
    eligibility_runs: Mapped[list["EligibilityRun"]] = relationship(
        "EligibilityRun",
        foreign_keys="EligibilityRun.run_by",
        back_populates="runner",
    )
    audit_events: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        foreign_keys="AuditLog.actor_user_id",
        back_populates="actor",
    )
    snapshots: Mapped[list["Snapshot"]] = relationship(
        "Snapshot",
        foreign_keys="Snapshot.created_by",
        back_populates="creator",
    )


class Role(TenantMixin, UUIDMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "name"),)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="roles")
    users: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="role")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="roles")
    role: Mapped[Role] = relationship("Role", back_populates="users")


class UserParty(Base):
    __tablename__ = "user_parties"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    party_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("parties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    relationship_name: Mapped[str | None] = mapped_column("relationship", String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship("User", back_populates="party_links")
    party: Mapped["Party"] = relationship("Party", back_populates="user_links")
