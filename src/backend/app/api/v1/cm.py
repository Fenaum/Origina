"""Capital Markets (CM) PoC router — thin routes per docs/CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §14.2.

All /cm/* routes are gated to `capital_markets` + `it_admin` via require_roles().
All write paths use `Depends(get_audited_db)` so the audit trigger records the actor.
All request shapes live in app.schemas.capital_markets_schema; this file only
parses, authorizes, delegates to the service layer, and shapes the response.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.capital_markets import (
    Allocation, Alert, BestExecutionRun, EligibilityResult,
    Investor, InvestorProgram, Lock, Pool,
)
from app.models.user import User
from app.security.roles import CAPITAL_MARKETS, IT_ADMIN, require_roles
from app.security.security import get_audited_db, get_current_user
from app.services.cm import (
    allocation_repo, audit_repo, best_ex_repo, lock_repo,
    material_change_repo, pipeline_repo, pool_repo,
)

router = APIRouter(prefix="/cm", tags=["capital-markets"])


# All /cm/* routes require the CM role or it_admin.
_CM_GUARD = Depends(require_roles(CAPITAL_MARKETS, IT_ADMIN))


# ── Request shapes (not full schemas; just what the router needs) ──────────────


class LockRequestBody(BaseModel):
    loan_id: UUID
    investor_program_id: UUID
    lock_period_days: int = Field(default=30, ge=15, le=180)


class LockConfirmBody(BaseModel):
    pass   # actor comes from current_user; no body needed for confirm


class LockExpireBody(BaseModel):
    pass


class LockRepriceBody(BaseModel):
    pass


class RepriceBody(BaseModel):
    pass


class BestExBody(BaseModel):
    loan_id: UUID
    lock_period_days: int = Field(default=30, ge=15, le=180)


class AllocationBody(BaseModel):
    loan_id: UUID
    best_execution_run_id: UUID
    investor_program_id: UUID
    pool_id: UUID | None = None
    override_reason: str | None = None
    override_actor_user_id: UUID | None = None
    notes: str | None = None


class PoolCreateBody(BaseModel):
    name: str
    target_close: str | None = None    # ISO date
    notes: str | None = None


class PoolAddLoanBody(BaseModel):
    loan_id: UUID


class AcknowledgeBody(BaseModel):
    pass


# ── /cm/pipeline (cockpit) ─────────────────────────────────────────────────────


@router.get("/pipeline", dependencies=[_CM_GUARD])
def get_pipeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/pipeline — cockpit summary (locked / floating / expected-funded
    balances + lock counts + open alerts)."""
    return pipeline_repo.pipeline_summary(db, tenant_id=current_user.tenant_id)


# ── /cm/loans/{id}/summary ────────────────────────────────────────────────────


@router.get("/loans/{loan_id}/summary", dependencies=[_CM_GUARD])
def get_loan_summary(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/loans/{id}/summary — current lock, history, latest best-ex,
    open alerts, pool membership."""
    summary = pipeline_repo.loan_cm_summary(
        db, tenant_id=current_user.tenant_id, loan_id=loan_id,
    )
    if summary is None:
        raise HTTPException(status_code=404, detail="No CM activity for this loan")
    return summary


# ── /cm/loans (list — drives Pipeline + Lock queue modules) ──────────────────


@router.get("/loans", dependencies=[_CM_GUARD])
def list_cm_loans(
    status: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/loans — list loans with at least one lock (the CM-active book).
    Optional ?status=... filter narrows to a single lock status (used by the
    Lock queue module to filter to REQUESTED / REPRICE_REQUIRED / EXPIRED)."""
    return pipeline_repo.list_cm_loans(
        db, tenant_id=current_user.tenant_id, status=status, limit=limit,
    )


# ── /cm/locks ─────────────────────────────────────────────────────────────────


@router.post(
    "/locks",
    response_model=None,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_CM_GUARD],
)
def create_lock(
    body: LockRequestBody,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/locks — request a lock. Pricing computed eagerly; lock row
    inserted in `requested` status. Confirm is a separate call."""
    try:
        result = lock_repo.request_lock(
            db, tenant_id=current_user.tenant_id, loan_id=body.loan_id,
            investor_program_id=body.investor_program_id,
            lock_period_days=body.lock_period_days,
            actor_user_id=current_user.id,
        )
        db.commit()
        db.refresh(result.lock)
        return _lock_out(result.lock)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/locks/{lock_id}/confirm", dependencies=[_CM_GUARD])
def confirm_lock(
    lock_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/locks/{id}/confirm — confirm a `requested` lock.

    Authority (PIN 2): the requester cannot confirm their own lock. The PoC
    enforces this in lock_repo.confirm_lock; this route surfaces a 403.
    """
    try:
        result = lock_repo.confirm_lock(
            db, tenant_id=current_user.tenant_id, lock_id=lock_id,
            actor_user_id=current_user.id,
        )
        db.commit()
        db.refresh(result.lock)
        return _lock_out(result.lock)
    except PermissionError as e:
        db.rollback()
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/locks/{lock_id}/expire", dependencies=[_CM_GUARD])
def expire_lock(
    lock_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/locks/{id}/expire — mark a confirmed/reprice_required/extended
    lock as EXPIRED. (PoC: called manually via the demo; production would be
    a background poller.)"""
    try:
        result = lock_repo.expire_lock(
            db, tenant_id=current_user.tenant_id, lock_id=lock_id,
            actor_user_id=current_user.id,
        )
        db.commit()
        db.refresh(result.lock)
        return _lock_out(result.lock)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/loans/{loan_id}/reprice", dependencies=[_CM_GUARD])
def reprice_loan(
    loan_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/loans/{id}/reprice — issue a reprice on the loan's active lock.
    Prior lock → EXPIRED; fresh lock inserted in CONFIRMED, chained via
    prior_lock_id. Pricing computed from the CURRENT loan snapshot."""
    try:
        result = lock_repo.reprice_lock(
            db, tenant_id=current_user.tenant_id, loan_id=loan_id,
            actor_user_id=current_user.id,
        )
        db.commit()
        db.refresh(result.lock)
        return _lock_out(result.lock)
    except PermissionError as e:
        db.rollback()
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# ── /cm/eligibility/evaluate ─────────────────────────────────────────────────


@router.post("/eligibility/evaluate", dependencies=[_CM_GUARD])
def evaluate_eligibility(
    body: BestExBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/eligibility/evaluate — evaluate the loan against every active
    investor program. Returns the list of (program, passed, failing_rules)
    plus the persisted cm_eligibility_results row ids."""
    from app.models.capital_markets import InvestorProgram
    from app.services.cm.snapshot import capture_loan_snapshot
    from app.services.cm.eligibility_repo import evaluate_and_persist

    snapshot = lock_repo.capture_loan_snapshot(
        db, loan_id=body.loan_id, lock_period_days=body.lock_period_days,
    )
    from app.services.cm.snapshot import capture_versions
    snapshot_versions = capture_versions(db)

    programs = (
        db.query(InvestorProgram)
        .filter(
            InvestorProgram.tenant_id == current_user.tenant_id,
            InvestorProgram.status == "active",
        )
        .all()
    )
    results = []
    for prog in programs:
        res_id, outcome = evaluate_and_persist(
            db, tenant_id=current_user.tenant_id, loan_id=body.loan_id,
            investor_program_id=prog.id, snapshot=snapshot,
            snapshot_versions=snapshot_versions,
        )
        results.append({
            "investor_program_id": str(prog.id),
            "passed": outcome.passed,
            "failing_rules": [
                {"rule_code": o.rule_code, "expected": o.expected,
                 "observed": o.observed, "severity": o.severity,
                 "source": o.source}
                for o in outcome.failing_rules
            ],
            "result_id": str(res_id),
        })
    db.commit()
    return {"loan_id": str(body.loan_id), "results": results}


# ── /cm/best-ex/run ──────────────────────────────────────────────────────────


@router.post("/best-ex/run", dependencies=[_CM_GUARD])
def run_best_ex(
    body: BestExBody,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/best-ex/run — compute best-ex for the loan against all
    active investor programs. Persists eligibility results + best-ex run.
    Returns the ranked table + chosen program."""
    try:
        snapshot = lock_repo.capture_loan_snapshot(
            db, loan_id=body.loan_id, lock_period_days=body.lock_period_days,
        )
        outcome = best_ex_repo.run_best_execution(
            db, tenant_id=current_user.tenant_id, loan_id=body.loan_id,
            snapshot=snapshot,
        )
        db.commit()
        return {
            "run_id": str(outcome.run_id),
            "loan_id": str(body.loan_id),
            "chosen": {
                "investor_program_id": str(outcome.chosen.investor_program_id),
                "investor_name": outcome.chosen.investor_name,
                "net_proceeds": outcome.chosen.net_proceeds,
            } if outcome.chosen else None,
            "variance_to_second": outcome.variance_to_second,
            "rationale": outcome.rationale,
            "ranked": [
                {
                    "rank": r.rank,
                    "investor_program_id": str(r.investor_program_id),
                    "investor_name": r.investor_name,
                    "rate_bps": r.rate_bps,
                    "llpa_total_bps": r.llpa_total_bps,
                    "srp_bps": r.srp_bps,
                    "delivery_fee": r.delivery_fee,
                    "net_proceeds": r.net_proceeds,
                    "eligibility_passed": r.eligibility_passed,
                    "failing_rules": r.failing_rules,
                }
                for r in outcome.ranked
            ],
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# ── /cm/allocations ───────────────────────────────────────────────────────────


@router.post(
    "/allocations",
    response_model=None,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_CM_GUARD],
)
def create_allocation(
    body: AllocationBody,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/allocations — insert an immutable allocation. Supersedes any
    prior active allocation on the same loan. Override requires a separate
    approver (PIN 2)."""
    try:
        row = allocation_repo.create_allocation(
            db, tenant_id=current_user.tenant_id, loan_id=body.loan_id,
            best_execution_run_id=body.best_execution_run_id,
            investor_program_id=body.investor_program_id,
            allocated_by=current_user.id,
            pool_id=body.pool_id,
            override_reason=body.override_reason,
            override_actor_user_id=body.override_actor_user_id or (
                current_user.id if body.override_reason else None
            ),
            notes=body.notes,
        )
        db.commit()
        db.refresh(row)
        return _allocation_out(row)
    except PermissionError as e:
        db.rollback()
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# ── /cm/pools ─────────────────────────────────────────────────────────────────


@router.post(
    "/pools",
    response_model=None,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_CM_GUARD],
)
def create_pool(
    body: PoolCreateBody,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/pools — open a new pool."""
    from datetime import date
    target_close = date.fromisoformat(body.target_close) if body.target_close else None
    pool = pool_repo.create_pool(
        db, tenant_id=current_user.tenant_id, name=body.name,
        created_by=current_user.id, target_close=target_close, notes=body.notes,
    )
    db.commit()
    db.refresh(pool)
    return {"id": str(pool.id), "name": pool.name, "status": pool.status}


@router.get("/pools", dependencies=[_CM_GUARD])
def list_pools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/pools — list pools."""
    pools = pool_repo.list_pools(db, tenant_id=current_user.tenant_id)
    return [
        {"id": str(p.id), "name": p.name, "status": p.status,
         "target_close": p.target_close.isoformat() if p.target_close else None}
        for p in pools
    ]


@router.post("/pools/{pool_id}/loans", dependencies=[_CM_GUARD])
def add_loan_to_pool(
    pool_id: UUID,
    body: PoolAddLoanBody,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/pools/{id}/loans — add a loan to a pool (membership)."""
    try:
        m = pool_repo.add_loan_to_pool(
            db, tenant_id=current_user.tenant_id, pool_id=pool_id,
            loan_id=body.loan_id, added_by=current_user.id,
        )
        db.commit()
        return {"pool_id": str(m.pool_id), "loan_id": str(m.loan_id)}
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# ── /cm/alerts ────────────────────────────────────────────────────────────────


@router.get("/alerts", dependencies=[_CM_GUARD])
def list_alerts(
    loan_id: UUID | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/alerts — list alerts (default: open only, newest first)."""
    from app.services.cm import alert_repo
    rows = alert_repo.list_open_alerts(
        db, tenant_id=current_user.tenant_id, loan_id=loan_id, limit=limit,
    )
    return [
        {"id": str(a.id), "loan_id": str(a.loan_id),
         "alert_type": a.alert_type, "severity": a.severity,
         "status": a.status, "message": a.message,
         "raised_at": a.raised_at.isoformat(),
         "related_entity_type": a.related_entity_type,
         "related_entity_id": str(a.related_entity_id) if a.related_entity_id else None}
        for a in rows
    ]


@router.post("/alerts/{alert_id}/acknowledge", dependencies=[_CM_GUARD])
def acknowledge_alert(
    alert_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.cm import alert_repo
    try:
        a = alert_repo.acknowledge_alert(
            db, tenant_id=current_user.tenant_id, alert_id=alert_id,
            actor_user_id=current_user.id,
        )
        db.commit()
        return {"id": str(a.id), "status": a.status}
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))


# ── /cm/audit/{entity_type}/{id} ──────────────────────────────────────────────


@router.get("/audit/loan/{loan_id}", dependencies=[_CM_GUARD])
def audit_for_loan(
    loan_id: UUID,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GET /cm/audit/loan/{id} — full audit chain for a loan.

    This is the load-bearing endpoint for PoC §14.3 #6: lock → change →
    reprice → re-rank → allocation, with actors and timestamps.
    """
    return audit_repo.reconstruct_for_loan(
        db, tenant_id=current_user.tenant_id, loan_id=loan_id, limit=limit,
    )


# ── Internal helper used by tests / the material-change demo path ────────────


@router.post("/_internal/detect-material-change/{loan_id}", dependencies=[_CM_GUARD])
def internal_detect_material_change(
    loan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST /cm/_internal/detect-material-change/{loan_id}

    Runs the material-change watcher against the current loan state. Flags
    any active lock `reprice_required` and raises alerts for block hits.

    The watcher is normally invoked by a background poller (Milestone 3);
    for the PoC we expose it as a route so the demo can trigger it after
    editing a loan. The `_internal` prefix signals "not for production UI".
    """
    outcome = material_change_repo.detect_material_change(
        db, tenant_id=current_user.tenant_id, loan_id=loan_id,
        actor_user_id=current_user.id,
    )
    db.commit()
    return {
        "loan_id": str(loan_id),
        "prior_hash": outcome.prior_hash,
        "current_hash": outcome.current_hash,
        "changed": outcome.changed,
        "hits": [
            {"field": h.field_name, "impact": h.impact, "severity": h.severity,
             "observed_value": h.observed_value, "snapshot_value": h.snapshot_value,
             "description": h.description}
            for h in outcome.hits
        ],
        "flags_raised": outcome.flags_raised,
        "alerts_raised": outcome.alerts_raised,
    }


# ── Out-shapes ────────────────────────────────────────────────────────────────


def _lock_out(l: Lock) -> dict[str, Any]:
    return {
        "id": str(l.id),
        "loan_id": str(l.loan_id),
        "rate_sheet_id": str(l.rate_sheet_id),
        "snapshot_hash": l.snapshot_hash,
        "snapshot_versions": l.snapshot_versions,
        "rate_bps": float(l.rate_bps),
        "base_price": float(l.base_price),
        "llpa_adjustments": l.llpa_adjustments,
        "srp_bps": float(l.srp_bps),
        "delivery_fee": float(l.delivery_fee),
        "adjusted_price": float(l.adjusted_price),
        "net_price": float(l.net_price),
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
    }


def _allocation_out(a: Allocation) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "loan_id": str(a.loan_id),
        "pool_id": str(a.pool_id) if a.pool_id else None,
        "best_execution_run_id": str(a.best_execution_run_id),
        "investor_program_id": str(a.investor_program_id),
        "status": a.status,
        "prior_allocation_id": str(a.prior_allocation_id) if a.prior_allocation_id else None,
        "override_reason": a.override_reason,
        "override_actor_user_id": str(a.override_actor_user_id) if a.override_actor_user_id else None,
        "notes": a.notes,
        "allocated_by": str(a.allocated_by),
        "allocated_at": a.allocated_at.isoformat(),
    }
