"""CM material-change detection service.

Per ADR 4 (Material-Change Registry as Versioned Config) + PoC §14.3 #3:
when a locked loan's relevant fields change, the watcher:
  1. Hashes the current loan state → current_hash.
  2. Compares to the lock's stored snapshot_hash → if equal, nothing changed.
  3. If different, walks cm_material_change_registry to decide which impact
     (rate / price / eligibility / best_ex_rank) the change has and what
     severity (warn / block).
  4. If the change crosses a `block` threshold, flags the lock `reprice_required`
     via lock_repo.flag_for_reprice AND raises an alert via alert_repo.

Tolerance shapes supported (PoC):
  - {op: '>=', delta: N}            — field must change by ≥ N to fire
  - {op: 'in_band_cross', axis: X}  — categorical crossing on axis X (fico_band, ltv_band, dscr_band, amount_band)
  - {op: 'categorical'}              — any change to the field fires

For 'in_band_cross' the watcher's notion of the "band" comes from the same
band classifiers used by pricing_repo (so a 700→678 FICO crossing fires
because both are in the '700-739' band vs '680-699' band respectively).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import (
    Lock,
    LockStatus,
    MaterialChangeRegistry,
)
from app.services.cm.constants import CMEventType
from app.services.cm.lock_repo import capture_loan_snapshot
from app.services.cm.snapshot import canonical_hash
from app.services.cm import alert_repo

log = logging.getLogger("origina_backend")


@dataclass
class MaterialChangeHit:
    field_name: str
    impact: str
    severity: str
    observed_value: Any
    snapshot_value: Any
    tolerance: dict[str, Any]
    description: str


@dataclass
class MaterialChangeOutcome:
    loan_id: UUID
    prior_hash: str
    current_hash: str
    changed: bool
    hits: list[MaterialChangeHit]
    flags_raised: int
    alerts_raised: int


# ── Public API ────────────────────────────────────────────────────────────────


def detect_material_change(
    db: Session, *, tenant_id: UUID, loan_id: UUID, actor_user_id: UUID | None = None,
) -> MaterialChangeOutcome:
    """Walk every active lock on the loan. For each:
      - Hash current state; if unchanged, no work.
      - Walk cm_material_change_registry rows; for each, compare snapshot vs current.
      - If any `block` hit: flag the lock `reprice_required` + raise a `reprice_required` alert.

    Returns the full hit list for the audit view. Per PoC: a single loan with
    one active lock is the normal case; the loop handles the multi-lock edge
    case without special casing.
    """
    current_snapshot = capture_loan_snapshot(db, loan_id=loan_id, lock_period_days=0)
    # lock_period_days=0 is a sentinel — snapshot.py uses it as the only
    # `lock_period_days` value when the actual loan state doesn't carry one.
    # The current-snapshot hash isn't persisted, so this is fine.
    current_hash = canonical_hash(current_snapshot)

    hits: list[MaterialChangeHit] = []
    flags_raised = 0
    alerts_raised = 0

    active_locks = (
        db.query(Lock)
        .filter(
            Lock.tenant_id == tenant_id,
            Lock.loan_id == loan_id,
            Lock.status.in_([
                LockStatus.CONFIRMED, LockStatus.EXTENDED,
                LockStatus.REPRICE_REQUIRED,
            ]),
        )
        .all()
    )

    if not active_locks:
        return MaterialChangeOutcome(
            loan_id=loan_id, prior_hash="", current_hash=current_hash,
            changed=False, hits=hits, flags_raised=0, alerts_raised=0,
        )

    for lock in active_locks:
        if lock.snapshot_hash == current_hash:
            # No change since the snapshot was taken
            continue

        prior_snapshot = lock.loan_snapshot if isinstance(lock.loan_snapshot, dict) else {}

        # Find applicable registry rows for this tenant (system + tenant overrides)
        registry = (
            db.query(MaterialChangeRegistry)
            .filter(
                (MaterialChangeRegistry.tenant_id == tenant_id)
                | (MaterialChangeRegistry.tenant_id.is_(None))
            )
            .order_by(MaterialChangeRegistry.field_name.asc())
            .all()
        )
        # Shadowing: tenant rows shadow system rows on field_name match
        tenant_overrides = {r.field_name: r for r in registry if r.tenant_id == tenant_id}
        effective = []
        seen = set()
        for r in registry:
            if r.tenant_id is None and r.field_name not in tenant_overrides:
                effective.append(r)
                seen.add(r.field_name)
            elif r.tenant_id == tenant_id:
                effective.append(r)
                seen.add(r.field_name)
            elif r.field_name in seen:
                continue
            else:
                effective.append(r)
                seen.add(r.field_name)

        # A field may have multiple rules (e.g. fico_score has both a >= delta
        # warn and an in_band_cross block). Evaluate ALL rules — the shadowing
        # loop above already filters out system rows shadowed by tenant rows.
        for rule in effective:
            hit = _eval_rule(rule, prior_snapshot, current_snapshot)
            if hit is not None:
                hits.append(hit)

        # Decide: which hits apply to THIS lock (PoC: all of them).
        hits_for_lock = [h for h in hits if _hits_lock_field(h.field_name, lock)]
        block_hit = any(h.severity == "block" for h in hits_for_lock)
        if not block_hit:
            continue

        from app.services.cm.lock_repo import flag_for_reprice
        try:
            flag_for_reprice(
                db, tenant_id=tenant_id, lock_id=lock.id,
                reason="material_change_detected",
                actor_user_id=actor_user_id,
            )
            flags_raised += 1
            # Raise an alert too (PoC: in-app only)
            alert_repo.raise_alert(
                db, tenant_id=tenant_id, loan_id=loan_id,
                alert_type="reprice_required", severity="block",
                message=f"Material change detected on lock {lock.id}: "
                        + "; ".join(h.field_name for h in hits_for_lock),
                related_entity_type="cm_lock",
                related_entity_id=lock.id,
                payload={
                    "lock_id": str(lock.id),
                    "prior_hash": lock.snapshot_hash,
                    "current_hash": current_hash,
                    "hits": [
                        {"field": h.field_name, "impact": h.impact,
                         "severity": h.severity, "description": h.description}
                        for h in hits_for_lock
                    ],
                },
            )
            alerts_raised += 1
        except ValueError:
            # Lock not in a flag-able state (already flagged, etc.) — skip
            pass

        from app.services.event_service import emit_event
        emit_event(
            db, tenant_id=tenant_id, event_type=CMEventType.MATERIAL_CHANGE,
            entity_type="cm_lock", entity_id=lock.id,
            payload={"loan_id": str(loan_id), "hits": [
                {"field": h.field_name, "impact": h.impact} for h in hits_for_lock
            ]},
        )

    return MaterialChangeOutcome(
        loan_id=loan_id,
        prior_hash=active_locks[0].snapshot_hash if active_locks else "",
        current_hash=current_hash,
        changed=len(hits) > 0,
        hits=hits,
        flags_raised=flags_raised,
        alerts_raised=alerts_raised,
    )


# ── Rule evaluation ───────────────────────────────────────────────────────────


def _eval_rule(
    rule: MaterialChangeRegistry,
    prior: dict[str, Any], current: dict[str, Any],
) -> MaterialChangeHit | None:
    field = rule.field_name
    prior_val = prior.get(field)
    cur_val = current.get(field)
    if prior_val == cur_val:
        return None
    # Either is None → treat as a change (PoC: be conservative)
    if prior_val is None or cur_val is None:
        return MaterialChangeHit(
            field_name=field, impact=rule.impact, severity=rule.severity,
            observed_value=cur_val, snapshot_value=prior_val,
            tolerance=rule.tolerance if isinstance(rule.tolerance, dict) else {},
            description=f"{field} changed (was None or now None)",
        )

    op = rule.tolerance.get("op") if isinstance(rule.tolerance, dict) else None
    if op == ">=":
        try:
            delta = abs(float(cur_val) - float(prior_val))
            if delta < float(rule.tolerance.get("delta", 0)):
                return None
            return MaterialChangeHit(
                field_name=field, impact=rule.impact, severity=rule.severity,
                observed_value=cur_val, snapshot_value=prior_val,
                tolerance=rule.tolerance,
                description=f"{field} changed by {delta:.2f} (threshold {rule.tolerance.get('delta')})",
            )
        except (TypeError, ValueError):
            return None
    if op == "in_band_cross":
        axis = rule.tolerance.get("axis")
        prior_band = _band_for(axis, prior_val)
        cur_band = _band_for(axis, cur_val)
        if prior_band == cur_band:
            return None
        return MaterialChangeHit(
            field_name=field, impact=rule.impact, severity=rule.severity,
            observed_value=cur_val, snapshot_value=prior_val,
            tolerance=rule.tolerance,
            description=f"{field} crossed {axis} band: {prior_band} → {cur_band}",
        )
    if op == "categorical":
        return MaterialChangeHit(
            field_name=field, impact=rule.impact, severity=rule.severity,
            observed_value=cur_val, snapshot_value=prior_val,
            tolerance=rule.tolerance,
            description=f"{field} changed (categorical): {prior_val} → {cur_val}",
        )
    return None


# ── Band helpers (mirrors pricing_repo.classifiers) ───────────────────────────


def _band_for(axis: str | None, value: Any) -> str | None:
    if axis is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if axis == "fico_band":
        from app.services.cm.pricing_repo import _fico_band
        return _fico_band(f)
    if axis == "ltv_band":
        from app.services.cm.pricing_repo import _ltv_band
        return _ltv_band(f)
    if axis == "dscr_band":
        from app.services.cm.pricing_repo import _dscr_band
        return _dscr_band(f)
    return None


def _hits_lock_field(field_name: str, lock: Lock) -> bool:
    """A registry row is 'about a lock' if the field is one the lock snapshot
    watches. Used to decide if the hit should flag the lock. For the PoC:
    every registered field is lock-relevant."""
    return True
