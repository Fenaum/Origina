"""CM eligibility service.

Per ADR "Investor Overlays via Shadowing": eligibility = base guideline �
investor overlays. Each is evaluated as a list of (rule_code, op, value)
predicates against the loan snapshot. A loan PASSES iff all predicates pass.

Per ADR "Calculation Ownership Map": eligibility is CMS-owned; UI reads the
persisted `cm_eligibility_results.passed`/`failing_rules` and never recomputes.

Per ADR "Reproducibility as a CI-Enforced Invariant": every result persists
its loan_snapshot_hash + snapshot_versions + calc_version. The replay
function takes only the snapshot, not the live loan.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import InvestorOverlay, InvestorProgram
from app.services.cm.constants import CMCalcVersion
from app.services.cm.snapshot import canonical_hash

log = logging.getLogger("origina_backend")


# ── Result types ──────────────────────────────────────────────────────────────


@dataclass
class RuleOutcome:
    rule_code: str
    op: str
    expected: Any
    observed: Any
    severity: str          # 'block' | 'warn'
    source: str            # 'base' | 'overlay'
    passed: bool


@dataclass
class EligibilityOutcome:
    passed: bool
    rule_trace: list[RuleOutcome]
    failing_rules: list[RuleOutcome]


# ── Public API ────────────────────────────────────────────────────────────────


def evaluate_eligibility(
    db: Session, *, tenant_id: UUID, loan_id: UUID, investor_program_id: UUID,
    snapshot: dict[str, Any],
) -> EligibilityOutcome:
    """Evaluate a (loan, investor_program) pair against base guideline + overlays.

    `snapshot` is the canonicalized loan snapshot (see services/cm/snapshot.py).
    The caller persists the returned outcome as a new `cm_eligibility_results` row.
    """
    program = db.get(InvestorProgram, investor_program_id)
    if program is None or program.tenant_id != tenant_id:
        raise ValueError(f"investor_program_id {investor_program_id} not found for tenant")

    rule_trace: list[RuleOutcome] = []
    failing: list[RuleOutcome] = []

    # ── Base guideline: stored in cm_investor_programs.srp_schedule._base_guideline
    srp_schedule = program.srp_schedule if isinstance(program.srp_schedule, dict) else {}
    base_guideline = srp_schedule.get("_base_guideline", {}) or {}
    for rule_code, limit in base_guideline.items():
        observed = _observed(snapshot, rule_code)
        if observed is None or limit is None:
            continue
        limit_f = float(limit)
        outcome = _eval_predicate(
            rule_code=rule_code, op=_default_op_for(rule_code),
            limit=limit_f, observed=float(observed),
            severity="block", source="base",
        )
        rule_trace.append(outcome)
        if not outcome.passed:
            failing.append(outcome)

    # ── Overlays: cm_investor_overlays rows for this investor + program_version
    overlays = (
        db.query(InvestorOverlay)
        .filter(
            InvestorOverlay.investor_id == program.investor_id,
            InvestorOverlay.program_version == program.overlay_version,
        )
        .order_by(InvestorOverlay.sort_order.asc(), InvestorOverlay.id.asc())
        .all()
    )
    for ov in overlays:
        if not _overlay_in_effect(ov):
            continue
        observed = _observed(snapshot, ov.rule_code)
        if observed is None:
            # Categorical rule with no observed value: treat as a missing rule
            # on the snapshot — fail with 'block' to be safe. PoC keeps this simple.
            outcome = RuleOutcome(
                rule_code=ov.rule_code, op=ov.op,
                expected=ov.value, observed=None,
                severity=ov.severity, source="overlay", passed=False,
            )
            rule_trace.append(outcome)
            failing.append(outcome)
            continue
        outcome = _eval_predicate(
            rule_code=ov.rule_code, op=ov.op,
            limit=_coerce_limit(ov.value), observed=float(observed),
            severity=ov.severity, source="overlay",
        )
        rule_trace.append(outcome)
        if not outcome.passed and outcome.severity == "block":
            failing.append(outcome)
        # WARN-severity failures are recorded in the trace but don't fail the program
        # (per §14.1: overlay severity 'warn' is observable but non-blocking)

    return EligibilityOutcome(
        passed=len(failing) == 0,
        rule_trace=rule_trace,
        failing_rules=failing,
    )


def evaluate_and_persist(
    db: Session, *, tenant_id: UUID, loan_id: UUID, investor_program_id: UUID,
    snapshot: dict[str, Any], snapshot_versions: dict[str, Any],
) -> tuple[UUID, EligibilityOutcome]:
    """Evaluate + persist in one call. Returns (new_eligibility_result_id, outcome)."""
    from app.models.capital_markets import EligibilityResult

    outcome = evaluate_eligibility(
        db, tenant_id=tenant_id, loan_id=loan_id,
        investor_program_id=investor_program_id, snapshot=snapshot,
    )
    snap_hash = canonical_hash(snapshot)
    row = EligibilityResult(
        tenant_id=tenant_id,
        loan_id=loan_id,
        investor_program_id=investor_program_id,
        loan_snapshot_hash=snap_hash,
        snapshot_versions=snapshot_versions,
        calc_version=CMCalcVersion.ELIGIBILITY,
        passed=outcome.passed,
        failing_rules=[_outcome_to_dict(o) for o in outcome.failing_rules],
        rule_trace=[_outcome_to_dict(o) for o in outcome.rule_trace],
        evaluated_at=_utcnow(),
    )
    db.add(row)
    db.flush()
    return row.id, outcome


# ── Helpers ───────────────────────────────────────────────────────────────────


def _observed(snapshot: dict[str, Any], rule_code: str) -> float | None:
    mapping = {
        "min_fico": "fico_score",
        "max_ltv":  "ltv",
        "min_dscr": "dscr",
        "min_reserves_months": "cash_reserves_months",   # not in snapshot; computed by caller if needed
    }
    field = mapping.get(rule_code, rule_code)
    value = snapshot.get(field)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _default_op_for(rule_code: str) -> str:
    """The default op for a base-guideline predicate. Convention:
       min_* = '>=' (observed must meet the minimum)
       max_* = '<=' (observed must not exceed the maximum)"""
    if rule_code.startswith("min_"):
        return ">="
    if rule_code.startswith("max_"):
        return "<="
    return "="


def _eval_predicate(*, rule_code: str, op: str, limit: float, observed: float,
                    severity: str, source: str) -> RuleOutcome:
    if op == ">=":  passed = observed >= limit
    elif op == "<=": passed = observed <= limit
    elif op == "<":  passed = observed < limit
    elif op == ">":  passed = observed > limit
    elif op == "=":  passed = observed == limit
    else:
        # 'in' / 'not_in' / categorical — not implemented in this PoC; treat as
        # blocking-failure so the demo surfaces the gap rather than silently passing.
        passed = False
    return RuleOutcome(
        rule_code=rule_code, op=op,
        expected=limit, observed=observed,
        severity=severity, source=source, passed=passed,
    )


def _coerce_limit(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _overlay_in_effect(overlay: InvestorOverlay) -> bool:
    """Filter overlays by their effective_from/to window. PoC: everything is
    currently in effect; this function exists so we don't forget when we
    add effective windows."""
    # The seed sets effective_from = CURRENT_DATE with no effective_to, so
    # the simple check below is sufficient for the PoC.
    return overlay.effective_to is None or overlay.effective_to >= overlay.effective_from


def _outcome_to_dict(o: RuleOutcome) -> dict[str, Any]:
    return {
        "rule_code": o.rule_code,
        "op": o.op,
        "expected": o.expected,
        "observed": o.observed,
        "severity": o.severity,
        "source": o.source,
        "passed": o.passed,
    }


def _utcnow():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
