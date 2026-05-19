# Shared base classes and mixins for all SQLAlchemy models.
#
# MIXIN PATTERN GUIDE — which base to inherit from:
#   BaseModel      → mutable entities that change over time: Loan, Borrower,
#                    Condition, Task, Party, User, Property, etc.
#                    Includes id + tenant_id + created_at + updated_at.
#
#   AppendOnlyModel → records written once, never modified: status events,
#                     audit entries, pricing/eligibility runs, documents.
#                     Includes id + tenant_id + created_at. No updated_at
#                     because updating these rows is a logic error.
#
#   Individual mixins (UUIDMixin, TenantMixin, TimestampMixin) — use only
#   for junction tables or unusual shapes that don't fit either base.

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


metadata = Base.metadata


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        # WHY lambda: datetime.now(timezone.utc) instead of datetime.utcnow:
        #   datetime.utcnow() is deprecated in Python 3.12 and returns a
        #   naive datetime (no timezone info) even though the column is
        #   timezone-aware. datetime.now(timezone.utc) is the correct
        #   replacement — it returns a UTC-aware datetime.
        #
        # NOTE: The DB trigger update_updated_at_column() also updates this
        #   column on every row update. The Python onupdate and the trigger
        #   are redundant by design: the trigger fires even when the ORM is
        #   bypassed (direct SQL, migrations), while the Python value is
        #   available in-process without needing a DB round-trip.
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UUIDMixin:
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )


class TenantMixin:
    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )


class BaseModel(TimestampMixin, UUIDMixin, TenantMixin, Base):
    # __abstract__ prevents SQLAlchemy from creating a table for BaseModel itself.
    # Every concrete subclass gets its own table with these columns included.
    __abstract__ = True


class AppendOnlyModel(UUIDMixin, TenantMixin, Base):
    """
    Base for records that are written once and never updated.

    WHY no updated_at: rows like audit log entries, status change events, and
    pricing run records should be immutable. Having an updated_at column
    implies the row can be changed — which it should not be. Omitting it
    makes that constraint visible in the schema itself.
    """
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
