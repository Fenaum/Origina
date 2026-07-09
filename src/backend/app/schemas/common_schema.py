"""Common Pydantic schemas shared across domains.

Pagination envelope (Sprint 1 introduced this in loan_schema; Sprint 2 lifts
it into its own module so every list endpoint can use it).
"""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard envelope for paginated list endpoints.

    Every list endpoint returns {"items": [...], "total": n} so the frontend
    can compute page counts and render pagination controls without a second
    request. Pydantic's Generic[T] is preserved through serialization —
    FastAPI strips the type parameter at runtime.
    """

    items: list[T]
    total: int
