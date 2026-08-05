"""CM pipeline / cockpit view service.

Per PoC §14.3 #1: pipeline shows locked / floating / expected-funded
balances that reconcile to seeded data. Computed live (not persisted) so
the view always reflects the current state without stale denormalizations.

Definitions (PoC):
  - locked       = SUM(loan_amount) of loans with a non-terminal active lock (CONFIRMED / EXTENDED / REPRICE_REQUIRED)
  - floating     = SUM(loan_amount) of loans with a REQUESTED lock (not yet confirmed)
  - expected_funded = SUM(loan_amount) of loans with a FUNDED_DELIVERED lock (closed)

All sums use loan_financials.loan_amount (the truth from the loan split).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.capital_markets import Lock, LockStatus
from app.models.loan import LoanFinancials


def pipeline_summary(db: Session, *, tenant_id: UUID) -> dict[str, Any]:
    """Return the CM cockpit view: total + per-status balance + lock counts."""
    locked = _balance_for(db, tenant_id=tenant_id, statuses=[
        LockStatus.CONFIRMED, LockStatus.EXTENDED, LockStatus.REPRICE_REQUIRED,
    ])
    floating = _balance_for(db, tenant_id=tenant_id, statuses=[LockStatus.REQUESTED])
    expected_funded = _balance_for(db, tenant_id=tenant_id, statuses=[LockStatus.FUNDED_DELIVERED])

    # Per-status lock counts (for the cockpit tiles)
    rows = (
        db.query(Lock.status, func.count(Lock.id))
        .filter(Lock.tenant_id == tenant_id)
        .group_by(Lock.status)
        .all()
    )
    counts = {s: int(c) for s, c in rows}

    # Alerts
    from app.models.capital_markets import Alert
    open_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.tenant_id == tenant_id, Alert.status == "open")
        .scalar() or 0
    )

    return {
        "balances": {
            "locked":            float(locked),
            "floating":          float(floating),
            "expected_funded":   float(expected_funded),
            "total_under_lock":  float(locked + floating + expected_funded),
        },
        "lock_counts": counts,
        "open_alerts": int(open_alerts),
    }


def _balance_for(db: Session, *, tenant_id: UUID, statuses: list[str]) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(LoanFinancials.loan_amount), 0))
        .join(Lock, Lock.loan_id == LoanFinancials.loan_id)
        .filter(Lock.tenant_id == tenant_id, Lock.status.in_(statuses))
        .scalar()
    )
    return Decimal(total or 0)


def loan_cm_summary(db: Session, *, tenant_id: UUID, loan_id: UUID) -> dict[str, Any] | None:
    """Return a per-loan CM summary: current lock (if any), latest best-ex,
    open alerts. Returns None if the loan has no CM activity yet.

    Shape (consumed by GET /cm/loans/{id}/summary):
      {
        "loan_id": str,
        "current_lock":    {lock row as dict} | None,
        "lock_history":    [lock rows as dict, newest first],
        "latest_best_ex":  {best-ex run row as dict} | None,
        "open_alerts":     [alert rows as dict, newest first],
        "pool_membership": [{pool_id, name}, ...]
      }
    """
    from app.models.capital_markets import (
        Alert, Allocation, BestExecutionRun, Lock, LockStatus, Pool, PoolLoan,
    )

    locks = (
        db.query(Lock)
        .filter(Lock.tenant_id == tenant_id, Lock.loan_id == loan_id)
        .order_by(Lock.requested_at.desc())
        .all()
    )
    if not locks:
        return None

    current_lock = next((l for l in locks if l.status in (
        LockStatus.CONFIRMED, LockStatus.EXTENDED, LockStatus.REPRICE_REQUIRED,
        LockStatus.REQUESTED,
    )), None)

    latest_best_ex = (
        db.query(BestExecutionRun)
        .filter(BestExecutionRun.tenant_id == tenant_id, BestExecutionRun.loan_id == loan_id)
        .order_by(BestExecutionRun.evaluated_at.desc())
        .first()
    )

    open_alerts = (
        db.query(Alert)
        .filter(
            Alert.tenant_id == tenant_id,
            Alert.loan_id == loan_id,
            Alert.status == "open",
        )
        .order_by(Alert.raised_at.desc())
        .all()
    )

    memberships = (
        db.query(Pool)
        .join(PoolLoan, PoolLoan.pool_id == Pool.id)
        .filter(PoolLoan.tenant_id == tenant_id, PoolLoan.loan_id == loan_id)
        .all()
    )

    def _lock_dict(l: Lock) -> dict[str, Any]:
        return {
            "id": str(l.id),
            "loan_id": str(l.loan_id),
            "rate_sheet_id": str(l.rate_sheet_id),
            "snapshot_hash": l.snapshot_hash,
            "rate_bps": float(l.rate_bps),
            "net_price": float(l.net_price),
            "llpa_adjustments": l.llpa_adjustments,
            "srp_bps": float(l.srp_bps),
            "delivery_fee": float(l.delivery_fee),
            "calc_version": l.calc_version,
            "lock_period_days": l.lock_period_days,
            "requested_at": l.requested_at.isoformat() if l.requested_at else None,
            "confirmed_at": l.confirmed_at.isoformat() if l.confirmed_at else None,
            "expires_at": l.expires_at.isoformat() if l.expires_at else None,
            "requested_by": str(l.requested_by) if l.requested_by else None,
            "confirmed_by": str(l.confirmed_by) if l.confirmed_by else None,
            "status": l.status,
            "reprice_required_at": l.reprice_required_at.isoformat() if l.reprice_required_at else None,
            "prior_lock_id": str(l.prior_lock_id) if l.prior_lock_id else None,
            "snapshot_versions": l.snapshot_versions,
        }

    return {
        "loan_id": str(loan_id),
        "current_lock": _lock_dict(current_lock) if current_lock else None,
        "lock_history": [_lock_dict(l) for l in locks],
        "latest_best_ex": (
            {
                "id": str(latest_best_ex.id),
                "evaluated_at": latest_best_ex.evaluated_at.isoformat(),
                "chosen_investor_program_id": str(latest_best_ex.chosen_investor_program_id) if latest_best_ex.chosen_investor_program_id else None,
                "variance_to_second": float(latest_best_ex.variance_to_second) if latest_best_ex.variance_to_second is not None else None,
                "rationale": latest_best_ex.rationale,
                "ranked_results": latest_best_ex.ranked_results,
                "calc_version": latest_best_ex.calc_version,
            } if latest_best_ex else None
        ),
        "open_alerts": [
            {
                "id": str(a.id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "status": a.status,
                "message": a.message,
                "raised_at": a.raised_at.isoformat(),
                "related_entity_type": a.related_entity_type,
                "related_entity_id": str(a.related_entity_id) if a.related_entity_id else None,
            }
            for a in open_alerts
        ],
        "pool_membership": [{"pool_id": str(p.id), "name": p.name} for p in memberships],
    }
