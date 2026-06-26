"""
SQLAlchemy model for analytics_saved_views (migration 130).

This model is **not** auto-created by `Base.metadata.create_all()` (the project
uses numbered SQL migrations as the schema source of truth). Adding this model
just exposes the table to SQLAlchemy so the analytics service can query it.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel


class SavedAnalyticsView(BaseModel):
    """A named, sharable analytics filter preset."""

    __tablename__ = "analytics_saved_views"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    filter_state: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
    )
    role_preset: Mapped[str | None] = mapped_column(Text)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # The created_by FK is enforced at the DB level but expressed here so
    # SQLAlchemy can eagerly join when needed.
    # NOTE: created_by is already declared on BaseModel via UUIDMixin + TenantMixin;
    # we don't redeclare it here.