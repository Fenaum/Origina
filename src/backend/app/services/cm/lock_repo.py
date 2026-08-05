"""CM lock lifecycle service.

Per ADR "Lock as Artifact (Not a Mutable Loan Status)":
  - Locks are first-class artifacts (cm_locks), not fields on loans.
  - Core priced terms are immutable after confirm.
  - State changes go through cm_lock_events (append-only).
  - Relocks write a new row chained via prior_lock_id.
  - One active non-terminal lock per loan (enforced by partial unique index).

Per ADR "Calculation Ownership Map": the priced terms on cm_locks are the
single source of truth. Reprice does not mutate the existing row — it
flags the existing lock `reprice_required` AND, on the reprice action,
inserts a fresh `cm_locks` row chained via prior_lock_id.

Per ADR "Reproducibility as a CI-Enforced Invariant": every confirm
captures (loan_snapshot, snapshot_hash, snapshot_versions, calc_version)
so pricing replays from the snapshot, not live loan data.

Per PIN 2 (Milestone-1): the approver≠requester authority check is
enforced in code for the PoC (not in a separate role table).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.capital_markets import (
    InvestorProgram,
    Lock,
    LockEvent,
    LockStatus,
    RateSheet,
    RateSheetStatus,
)
from app.models.loan import Loan, LoanFinancials, LoanTerms
from app.services.cm.constants import CMCalcVersion, CMEventType, LOCK_POLICY_VERSION
from app.services.cm.snapshot import capture_snapshot, capture_versions, canonical_hash

log = logging.getLogger("origina_backend")


# ── Result types ──────────────────────────────────────────────────────────────


@dataclass
class LockResult:
    lock: Lock
    priced_snapshot_hash: str
    is_reprice: bool


# ── Public API ────────────────────────────────────────────────────────────────


def request_lock(
    db: Session, *, tenant_id: UUID, loan_id: UUID, investor_program_id: UUID,
    lock_period_days: int, actor_user_id: UUID,
    channel: str = "origina",
) -> LockResult:
    """Create a `requested` lock. Pricing is computed eagerly from the current
    snapshot so the lock row carries the priced terms; on confirm those terms
    are snapshotted into loan_snapshot.

    Per PoC: rate-sheet + program are inferred from channel='origina' (default)
    and the investor_program_id provided by the caller.
    """
    _validate_loan(db, tenant_id, loan_id)
    program = db.get(InvestorProgram, investor_program_id)
    if program is None or program.tenant_id != tenant_id:
        raise ValueError(f"investor_program_id {investor_program_id} not found")

    rate_sheet = _get_active_rate_sheet(db, tenant_id=tenant_id, channel=channel)
    snapshot = capture_loan_snapshot(db, loan_id=loan_id, lock_period_days=lock_period_days)
    snapshot_versions = capture_versions(db)

    # Compute priced terms eagerly (so the UI can show price at request time)
    from app.services.cm.pricing_repo import price_lock
    priced = price_lock(
        db, tenant_id=tenant_id, snapshot=snapshot,
        srp_schedule=program.srp_schedule if isinstance(program.srp_schedule, dict) else {},
        channel=channel,
    )

    snap_hash = canonical_hash(snapshot)
    now = _utcnow()

    lock = Lock(
        tenant_id=tenant_id,
        loan_id=loan_id,
        rate_sheet_id=rate_sheet.id,
        loan_snapshot=snapshot,
        snapshot_hash=snap_hash,
        snapshot_versions=snapshot_versions,
        rate_bps=priced.rate_bps,
        base_price=priced.base_price,
        llpa_adjustments=priced.llpa_adjustments,
        srp_bps=priced.srp_bps,
        delivery_fee=priced.delivery_fee,
        adjusted_price=priced.adjusted_price,
        net_price=priced.net_price,
        calc_version=priced.calc_version,
        lock_period_days=lock_period_days,
        requested_at=now,
        confirmed_at=None,
        expires_at=None,
        requested_by=actor_user_id,
        confirmed_by=None,
        status=LockStatus.REQUESTED,
        reprice_required_at=None,
        prior_lock_id=None,
    )
    db.add(lock)
    db.flush()

    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=lock.id, event_type=LockStatus.REQUESTED,
        actor_user_id=actor_user_id, payload={
            "loan_snapshot_hash": snap_hash,
            "lock_period_days": lock_period_days,
            "investor_program_id": str(program.id),
        },
    )
    db.flush()

    return LockResult(lock=lock, priced_snapshot_hash=snap_hash, is_reprice=False)


def confirm_lock(
    db: Session, *, tenant_id: UUID, lock_id: UUID, actor_user_id: UUID,
) -> LockResult:
    """Confirm a requested lock. Snapshot is frozen at the current loan state
    (NOT the requested-time state — the loan may have drifted between request
    and confirm). The hash is recomputed so material-change detection starts
    from the confirm snapshot, not the request snapshot.
    """
    lock = _get_active_lock(db, tenant_id, lock_id)
    if lock.status != LockStatus.REQUESTED:
        raise ValueError(f"lock {lock_id} cannot be confirmed from status={lock.status!r}")
    if lock.requested_by == actor_user_id:
        # Authority check (PIN 2): the requester cannot confirm their own lock.
        # PoC: enforced in code. Phase 3 lifts to config + dedicated approver role.
        raise PermissionError("requester cannot confirm their own lock (PoC authority rule)")

    # Re-snapshot at confirm time
    snapshot = capture_loan_snapshot(db, loan_id=lock.loan_id, lock_period_days=lock.lock_period_days)
    snap_hash = canonical_hash(snapshot)
    snapshot_versions = capture_versions(db)

    now = _utcnow()
    expires_at = now + timedelta(days=lock.lock_period_days)

    # Core priced terms stay the same as requested (no recompute at confirm
    # unless the loan data changed materially — that's the material-change
    # watcher's job, called separately). For the PoC: confirm keeps the
    # terms that were priced at request time.
    lock.loan_snapshot = snapshot
    lock.snapshot_hash = snap_hash
    lock.snapshot_versions = snapshot_versions
    lock.confirmed_at = now
    lock.confirmed_by = actor_user_id
    lock.expires_at = expires_at
    lock.status = LockStatus.CONFIRMED
    lock.reprice_required_at = None
    db.flush()

    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=lock.id, event_type=LockStatus.CONFIRMED,
        actor_user_id=actor_user_id, payload={
            "rate_bps": float(lock.rate_bps),
            "net_price": float(lock.net_price),
            "loan_snapshot_hash": snap_hash,
            "expires_at": expires_at.isoformat(),
        },
        policy_version=LOCK_POLICY_VERSION,
    )

    from app.services.event_service import emit_event
    emit_event(
        db, tenant_id=tenant_id,
        event_type=CMEventType.LOCK_CONFIRMED,
        entity_type="cm_lock", entity_id=lock.id,
        payload={"loan_id": str(lock.loan_id), "net_price": float(lock.net_price)},
    )

    return LockResult(lock=lock, priced_snapshot_hash=snap_hash, is_reprice=False)


def expire_lock(
    db: Session, *, tenant_id: UUID, lock_id: UUID, actor_user_id: UUID | None,
) -> LockResult:
    """Move a confirmed lock to EXPIRED. Called by the lock-expiry poller.

    Per PoC: this is invoked explicitly via the POST /cm/locks/{id}/expire
    route (no background poller for the PoC — the demo flips the time
    manually via the seed script).
    """
    lock = _get_active_lock(db, tenant_id, lock_id)
    if lock.status not in (LockStatus.CONFIRMED, LockStatus.REPRICE_REQUIRED, LockStatus.EXTENDED):
        raise ValueError(f"lock {lock_id} cannot be expired from status={lock.status!r}")

    lock.status = LockStatus.EXPIRED
    db.flush()
    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=lock.id, event_type=LockStatus.EXPIRED,
        actor_user_id=actor_user_id, payload={"reason": "lock_period_elapsed"},
    )
    from app.services.event_service import emit_event
    emit_event(
        db, tenant_id=tenant_id, event_type=CMEventType.LOCK_EXPIRED,
        entity_type="cm_lock", entity_id=lock.id, payload={"loan_id": str(lock.loan_id)},
    )
    return LockResult(lock=lock, priced_snapshot_hash=lock.snapshot_hash, is_reprice=False)


def flag_for_reprice(
    db: Session, *, tenant_id: UUID, lock_id: UUID, reason: str,
    actor_user_id: UUID | None,
) -> LockResult:
    """Set a confirmed lock to REPRICE_REQUIRED. Called by the material-change
    watcher when it detects a threshold crossing on a registered field.

    Does NOT mutate priced terms — the existing row's terms are the audit
    record of what the loan was priced at. Reprice action inserts a fresh
    `cm_locks` row via `reprice_lock`.
    """
    lock = _get_active_lock(db, tenant_id, lock_id)
    if lock.status not in (LockStatus.CONFIRMED, LockStatus.EXTENDED):
        raise ValueError(f"lock {lock_id} cannot be flagged from status={lock.status!r}")

    now = _utcnow()
    lock.status = LockStatus.REPRICE_REQUIRED
    lock.reprice_required_at = now
    db.flush()

    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=lock.id,
        event_type="reprice_flagged",  # LockEventType.REPRICE_FLAGGED == 'reprice_flagged'
        actor_user_id=actor_user_id,
        payload={"reason": reason},
        policy_version=LOCK_POLICY_VERSION,
    )
    from app.services.event_service import emit_event
    emit_event(
        db, tenant_id=tenant_id, event_type=CMEventType.LOCK_REPRICE_FLAGGED,
        entity_type="cm_lock", entity_id=lock.id,
        payload={"loan_id": str(lock.loan_id), "reason": reason},
    )
    return LockResult(lock=lock, priced_snapshot_hash=lock.snapshot_hash, is_reprice=False)


def reprice_lock(
    db: Session, *, tenant_id: UUID, loan_id: UUID, actor_user_id: UUID,
    channel: str = "origina",
) -> LockResult:
    """Issue a reprice: insert a fresh confirmed lock row chained via prior_lock_id.

    The prior lock (in REPRICE_REQUIRED status) is moved to EXPIRED — its
    audit trail stays intact, but it's no longer active for this loan. The
    fresh row is the new "active" lock, with pricing computed from the
    CURRENT loan snapshot.

    Returns the new lock.
    """
    # Find the current active lock (the one we're repricing)
    prior = (
        db.query(Lock)
        .filter(
            Lock.tenant_id == tenant_id,
            Lock.loan_id == loan_id,
            Lock.status.in_([
                LockStatus.REPRICE_REQUIRED, LockStatus.CONFIRMED, LockStatus.REQUESTED,
            ]),
        )
        .order_by(Lock.requested_at.desc())
        .first()
    )
    if prior is None:
        raise ValueError(f"no active lock to reprice for loan {loan_id}")
    if prior.requested_by == actor_user_id:
        raise PermissionError("requester cannot reprice their own lock (PoC authority rule)")

    # Capture the prior lock's investor program (reuse it on the reprice)
    # PoC: the original request_lock stored the program on the row... actually
    # it didn't — programs aren't stored on locks (locks can be allocated to
    # any program via a separate allocation). For reprice we just use the same
    # program the original lock targeted via the most recent BestExRun if any.
    # Simpler: leave the program lookup to the router — accept program_id as
    # an arg if needed. For now, raise a clear error if no best-ex run exists.

    # Build the new lock via the request→confirm path on the fresh snapshot
    # The router supplies investor_program_id; we look it up here via a default:
    # the most recent best-ex run's chosen program.
    from app.models.capital_markets import BestExecutionRun
    best_ex = (
        db.query(BestExecutionRun)
        .filter(
            BestExecutionRun.tenant_id == tenant_id,
            BestExecutionRun.loan_id == loan_id,
        )
        .order_by(BestExecutionRun.evaluated_at.desc())
        .first()
    )
    if best_ex is None or best_ex.chosen_investor_program_id is None:
        raise ValueError(
            f"no best-ex run on loan {loan_id} — run POST /cm/best-ex/run first"
        )
    program_id = best_ex.chosen_investor_program_id
    program = db.get(InvestorProgram, program_id)
    if program is None:
        raise ValueError(f"investor_program_id {program_id} not found")

    # Expire the prior
    prior.status = LockStatus.EXPIRED
    db.flush()
    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=prior.id, event_type=LockStatus.EXPIRED,
        actor_user_id=actor_user_id, payload={"reason": "reprice_superseded"},
    )

    # Create + confirm the new lock
    requested = request_lock(
        db, tenant_id=tenant_id, loan_id=loan_id,
        investor_program_id=program_id, lock_period_days=prior.lock_period_days,
        actor_user_id=actor_user_id, channel=channel,
    )
    requested.lock.prior_lock_id = prior.id
    # Auto-confirm (the reprice action is a single call — request + confirm)
    requested.lock.confirmed_at = _utcnow()
    requested.lock.confirmed_by = actor_user_id
    requested.lock.expires_at = _utcnow() + timedelta(days=prior.lock_period_days)
    requested.lock.status = LockStatus.CONFIRMED
    db.flush()

    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=requested.lock.id,
        event_type=LockStatus.CONFIRMED, actor_user_id=actor_user_id,
        payload={"reprice_of": str(prior.id), "rate_bps": float(requested.lock.rate_bps),
                 "net_price": float(requested.lock.net_price)},
        policy_version=LOCK_POLICY_VERSION,
    )
    _emit_lock_event(
        db, tenant_id=tenant_id, lock_id=prior.id,
        event_type="repriced",  # LockEventType.REPRICED == 'repriced'
        actor_user_id=actor_user_id,
        payload={"superseded_by": str(requested.lock.id)},
        policy_version=LOCK_POLICY_VERSION,
    )

    from app.services.event_service import emit_event
    emit_event(
        db, tenant_id=tenant_id, event_type=CMEventType.LOCK_REPRICED,
        entity_type="cm_lock", entity_id=requested.lock.id,
        payload={"loan_id": str(loan_id), "prior_lock_id": str(prior.id)},
    )

    return LockResult(lock=requested.lock, priced_snapshot_hash=requested.lock.snapshot_hash, is_reprice=True)


# ── Helpers ───────────────────────────────────────────────────────────────────


def capture_loan_snapshot(db: Session, *, loan_id: UUID, lock_period_days: int) -> dict[str, Any]:
    """Convenience wrapper: load loan + financials + terms, build the snapshot."""
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise ValueError(f"loan {loan_id} not found")
    financials = (
        db.query(LoanFinancials).filter(LoanFinancials.loan_id == loan_id).first()
    )
    terms = (
        db.query(LoanTerms).filter(LoanTerms.loan_id == loan_id).first()
    )
    return capture_snapshot(
        loan=loan, financials=financials, terms=terms,
        lock_period_days=lock_period_days,
    )


def _validate_loan(db: Session, tenant_id: UUID, loan_id: UUID) -> None:
    loan = db.get(Loan, loan_id)
    if loan is None or loan.tenant_id != tenant_id:
        raise ValueError(f"loan {loan_id} not found for tenant")
    # Loans must have FICO + LTV to be priced (PoC scope)
    fin = db.query(LoanFinancials).filter(LoanFinancials.loan_id == loan_id).first()
    if fin is None or fin.fico_score is None or fin.ltv is None:
        raise ValueError(f"loan {loan_id} missing FICO or LTV (cannot price)")


def _get_active_lock(db: Session, tenant_id: UUID, lock_id: UUID) -> Lock:
    lock = db.get(Lock, lock_id)
    if lock is None or lock.tenant_id != tenant_id:
        raise ValueError(f"lock {lock_id} not found for tenant")
    return lock


def _get_active_rate_sheet(db: Session, *, tenant_id: UUID, channel: str) -> RateSheet:
    sheet = (
        db.query(RateSheet)
        .filter(
            RateSheet.tenant_id == tenant_id,
            RateSheet.channel == channel,
            RateSheet.status == RateSheetStatus.PUBLISHED,
        )
        .order_by(RateSheet.version.desc())
        .first()
    )
    if sheet is None:
        raise ValueError(f"no published rate sheet for channel={channel!r}")
    return sheet


def _emit_lock_event(
    db: Session, *, tenant_id: UUID, lock_id: UUID, event_type: str,
    actor_user_id: UUID | None, payload: dict[str, Any],
    policy_version: str | None = None,
    price_delta: float | None = None, cost: float | None = None,
) -> LockEvent:
    """Append-only log entry. Caller does NOT commit; the route handler does."""
    ev = LockEvent(
        tenant_id=tenant_id,
        lock_id=lock_id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload=payload,
        policy_version=policy_version,
        price_delta=price_delta,
        cost=cost,
    )
    db.add(ev)
    db.flush()
    return ev


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
