"""CM allocation service.

Per PoC §14.3 #5: allocations are IMMUTABLE. Re-allocation writes a new row
that points at the prior row via `prior_allocation_id`, and supersedes the
prior (`status='superseded'`). The partial unique index on (tenant_id,
loan_id) WHERE status='active' enforces one active allocation per loan.

Authority check (PIN 2): the approver≠requester rule is enforced in code.
For the PoC this is a soft check (`raise PermissionError`) — production
would enforce via a separate role + the `override_actor_user_id` field.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import (
    Allocation, AllocationStatus, BestExecutionRun, Pool,
)
from app.services.cm.constants import CMEventType


def create_allocation(
    db: Session, *, tenant_id: UUID, loan_id: UUID,
    best_execution_run_id: UUID, investor_program_id: UUID,
    allocated_by: UUID,
    pool_id: UUID | None = None,
    override_reason: str | None = None,
    override_actor_user_id: UUID | None = None,
    notes: str | None = None,
) -> Allocation:
    """Insert an immutable allocation row. Supersedes any prior active allocation
    on the same loan."""
    # Validate FKs
    run = db.get(BestExecutionRun, best_execution_run_id)
    if run is None or run.tenant_id != tenant_id:
        raise ValueError(f"best_execution_run_id {best_execution_run_id} not found for tenant")
    if pool_id is not None:
        pool = db.get(Pool, pool_id)
        if pool is None or pool.tenant_id != tenant_id:
            raise ValueError(f"pool {pool_id} not found for tenant")

    # Supersede any prior active allocation
    prior = (
        db.query(Allocation)
        .filter(
            Allocation.tenant_id == tenant_id,
            Allocation.loan_id == loan_id,
            Allocation.status == AllocationStatus.ACTIVE,
        )
        .first()
    )
    if prior is not None:
        prior.status = AllocationStatus.SUPERSEDED
        prior_new_row_id_holder = {"id": None}
        prior.prior_allocation_id = prior.id  # keep self-reference for clarity

    now = datetime.now(timezone.utc)

    # Authority check (PIN 2)
    if override_reason is not None and override_actor_user_id is None:
        raise PermissionError("override_actor_user_id is required when override_reason is set")
    if override_reason is not None and override_actor_user_id == allocated_by:
        raise PermissionError(
            "the requester cannot be the override approver (PIN 2 authority rule)"
        )

    row = Allocation(
        tenant_id=tenant_id,
        loan_id=loan_id,
        pool_id=pool_id,
        best_execution_run_id=best_execution_run_id,
        investor_program_id=investor_program_id,
        status=AllocationStatus.ACTIVE,
        prior_allocation_id=prior.id if prior else None,
        override_reason=override_reason,
        override_actor_user_id=override_actor_user_id,
        notes=notes,
        allocated_by=allocated_by,
        allocated_at=now,
    )
    db.add(row)
    db.flush()

    from app.services.event_service import emit_event
    emit_event(
        db, tenant_id=tenant_id, event_type=CMEventType.ALLOCATION_CREATED,
        entity_type="cm_allocation", entity_id=row.id,
        payload={
            "loan_id": str(loan_id),
            "investor_program_id": str(investor_program_id),
            "override": override_reason is not None,
            "pool_id": str(pool_id) if pool_id else None,
        },
    )

    return row


def list_allocations(
    db: Session, *, tenant_id: UUID, loan_id: UUID | None = None,
    pool_id: UUID | None = None, limit: int = 50,
) -> list[Allocation]:
    q = db.query(Allocation).filter(Allocation.tenant_id == tenant_id)
    if loan_id is not None:
        q = q.filter(Allocation.loan_id == loan_id)
    if pool_id is not None:
        q = q.filter(Allocation.pool_id == pool_id)
    return q.order_by(Allocation.allocated_at.desc()).limit(limit).all()
