"""CM pool service."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import Pool, PoolLoan, PoolStatus


def create_pool(
    db: Session, *, tenant_id: UUID, name: str, created_by: UUID,
    target_close=None, notes: str | None = None,
) -> Pool:
    pool = Pool(
        tenant_id=tenant_id,
        name=name,
        target_close=target_close,
        status=PoolStatus.OPEN,
        notes=notes,
        created_by=created_by,
    )
    db.add(pool)
    db.flush()
    return pool


def add_loan_to_pool(
    db: Session, *, tenant_id: UUID, pool_id: UUID, loan_id: UUID, added_by: UUID,
) -> PoolLoan:
    pool = db.get(Pool, pool_id)
    if pool is None or pool.tenant_id != tenant_id:
        raise ValueError(f"pool {pool_id} not found for tenant")
    if pool.status != PoolStatus.OPEN:
        raise ValueError(f"pool {pool_id} is not OPEN (status={pool.status!r})")
    # Disallow re-adding
    existing = (
        db.query(PoolLoan)
        .filter(PoolLoan.pool_id == pool_id, PoolLoan.loan_id == loan_id)
        .first()
    )
    if existing:
        return existing
    membership = PoolLoan(
        tenant_id=tenant_id,
        pool_id=pool_id,
        loan_id=loan_id,
        added_by=added_by,
    )
    db.add(membership)
    db.flush()
    return membership


def list_pools(db: Session, *, tenant_id: UUID) -> list[Pool]:
    return (
        db.query(Pool)
        .filter(Pool.tenant_id == tenant_id)
        .order_by(Pool.created_at.desc())
        .all()
    )
