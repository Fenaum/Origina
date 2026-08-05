"""CM audit reconstruction service.

Per PoC §14.3 #6: "The audit view reconstructs the full chain for the demo
loan: lock → change → reprice → re-rank → allocation, with actors and
timestamps."

This service pulls every audit_log row + every cm_lock_event + every
cm_eligibility_results + every cm_best_execution_runs + every cm_allocation
for an entity, ordered chronologically. The router exposes it under
GET /cm/audit/{entity_type}/{entity_id}.

The audit_log entries come from the log_audit_event() trigger (every CM
mutation writes one). cm_lock_event rows are the lock lifecycle log (already
chronological via created_at). Eligibility + best-ex + allocation are
single-row-per-decision artifacts; the chain is reconstructed via the
FK graph (allocation → best_ex_run → eligibility_results → lock).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import (
    Allocation, BestExecutionRun, EligibilityResult, Lock, LockEvent,
)


def reconstruct_for_loan(
    db: Session, *, tenant_id: UUID, loan_id: UUID, limit: int = 200,
) -> list[dict[str, Any]]:
    """Return a chronologically-ordered audit trail for a loan."""
    chain: list[tuple[datetime, dict[str, Any]]] = []

    # cm_lock_events for any lock on this loan
    locks = db.query(Lock).filter(Lock.tenant_id == tenant_id, Lock.loan_id == loan_id).all()
    for lock in locks:
        events = (
            db.query(LockEvent)
            .filter(LockEvent.lock_id == lock.id)
            .order_by(LockEvent.created_at.asc())
            .all()
        )
        for e in events:
            chain.append((e.created_at, {
                "kind": "lock_event",
                "lock_id": str(e.lock_id),
                "event_type": e.event_type,
                "actor_user_id": str(e.actor_user_id) if e.actor_user_id else None,
                "policy_version": e.policy_version,
                "payload": e.payload,
            }))

    # eligibility_results
    elig = (
        db.query(EligibilityResult)
        .filter(EligibilityResult.tenant_id == tenant_id, EligibilityResult.loan_id == loan_id)
        .order_by(EligibilityResult.evaluated_at.asc())
        .all()
    )
    for e in elig:
        chain.append((e.evaluated_at, {
            "kind": "eligibility",
            "id": str(e.id),
            "investor_program_id": str(e.investor_program_id),
            "passed": e.passed,
            "failing_rules": e.failing_rules,
            "loan_snapshot_hash": e.loan_snapshot_hash,
            "calc_version": e.calc_version,
        }))

    # best_execution_runs
    runs = (
        db.query(BestExecutionRun)
        .filter(BestExecutionRun.tenant_id == tenant_id, BestExecutionRun.loan_id == loan_id)
        .order_by(BestExecutionRun.evaluated_at.asc())
        .all()
    )
    for r in runs:
        chain.append((r.evaluated_at, {
            "kind": "best_ex_run",
            "id": str(r.id),
            "rate_sheet_id": str(r.rate_sheet_id),
            "chosen_investor_program_id": str(r.chosen_investor_program_id) if r.chosen_investor_program_id else None,
            "variance_to_second": float(r.variance_to_second) if r.variance_to_second is not None else None,
            "rationale": r.rationale,
            "calc_version": r.calc_version,
            "loan_snapshot_hash": r.loan_snapshot_hash,
        }))

    # allocations
    allocs = (
        db.query(Allocation)
        .filter(Allocation.tenant_id == tenant_id, Allocation.loan_id == loan_id)
        .order_by(Allocation.allocated_at.asc())
        .all()
    )
    for a in allocs:
        chain.append((a.allocated_at, {
            "kind": "allocation",
            "id": str(a.id),
            "best_execution_run_id": str(a.best_execution_run_id),
            "investor_program_id": str(a.investor_program_id),
            "status": a.status,
            "override_reason": a.override_reason,
            "allocated_by": str(a.allocated_by),
        }))

    # audit_log rows: every CM table mutation triggered log_audit_event().
    # For this loan, we want rows where entity_type starts with 'cm_' AND the
    # entity_id belongs to one of: the loan's locks, the lock's events, the
    # eligibility results / best-ex runs / allocations on this loan, or the
    # pool_membership rows. The simple filter: collect all relevant ids then
    # query audit_log WHERE entity_id IN (...) AND entity_type LIKE 'cm_%'.
    relevant_ids: set[str] = set()
    relevant_ids.update(str(l.id) for l in locks)
    for e in db.query(LockEvent).filter(LockEvent.lock_id.in_([l.id for l in locks])).all():
        relevant_ids.add(str(e.id))
    for e in elig:
        relevant_ids.add(str(e.id))
    for r in runs:
        relevant_ids.add(str(r.id))
    for a in allocs:
        relevant_ids.add(str(a.id))
    if not relevant_ids:
        return [item for _, item in chain[:limit]]
    from sqlalchemy import text
    rows = db.execute(
        text("""
            SELECT actor_user_id, entity_type, entity_id, action, occurred_at, diff
            FROM audit_log
            WHERE tenant_id = :tid
              AND entity_type LIKE 'cm_%'
              AND entity_id::text = ANY(:ids)
            ORDER BY occurred_at ASC
            LIMIT :lim
        """),
        {"tid": str(tenant_id), "ids": list(relevant_ids), "lim": limit},
    ).fetchall()
    for actor, etype, eid, action, occurred_at, diff in rows:
        chain.append((occurred_at, {
            "kind": "audit_log",
            "actor_user_id": str(actor) if actor else None,
            "entity_type": etype,
            "entity_id": str(eid),
            "action": action,
            "diff": diff,
        }))

    # Sort chronologically
    chain.sort(key=lambda x: x[0])
    return [item for _, item in chain[:limit]]
