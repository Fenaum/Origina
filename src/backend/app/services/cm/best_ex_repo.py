"""CM best-execution service.

Per ADR "Calculation Ownership Map": best-ex is CMS-owned. UI reads the
persisted `cm_best_execution_runs.ranked_results` and never recomputes.

Per §14.1 (PoC scope): best-ex net = investor base + investor LLPAs + SRP -
delivery fee. The seeded rate sheet is the Origina channel; per-investor
LPAs come from the same LLPA grids + the investor's overlay deltas (the
overlay delta is the *difference* between the investor's eligibility
threshold and the base, applied as an additional price component — PoC
simplification).

Per ADR "Reproducibility as a CI-Enforced Invariant": the full ranked table
is persisted on the row, so the run can be replayed end-to-end without
re-querying the grids or re-applying the overlays.

Tie-break rule (§14.1 explicit, default per working style): higher net
proceeds wins; ties broken by alphabetically smaller investor name; final
tie by smaller investor_program_id. Stable for reproducibility.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.capital_markets import (
    Investor,
    InvestorProgram,
    RateSheet,
    RateSheetStatus,
)
from app.services.cm.constants import CMCalcVersion, MARGIN_FLOOR_BPS, TIE_BREAK_ORDER
from app.services.cm.eligibility_repo import evaluate_and_persist, EligibilityOutcome
from app.services.cm.pricing_repo import PricedTerms, price_lock
from app.services.cm.snapshot import canonical_hash, capture_versions

log = logging.getLogger("origina_backend")


@dataclass
class RankedInvestor:
    rank: int
    investor_id: UUID
    investor_program_id: UUID
    investor_name: str
    rate_bps: float
    llpa_total_bps: float
    srp_bps: float
    delivery_fee: float
    net_proceeds: float
    adjusted_price: float
    base_price: float
    eligibility_passed: bool
    failing_rules: list[dict[str, Any]]
    breakdown: list[dict[str, Any]]


@dataclass
class BestExOutcome:
    run_id: UUID
    ranked: list[RankedInvestor]
    chosen: RankedInvestor
    variance_to_second: float
    rationale: str


# ── Public API ────────────────────────────────────────────────────────────────


def run_best_execution(
    db: Session, *, tenant_id: UUID, loan_id: UUID, snapshot: dict[str, Any],
    channel: str = "origina",
) -> BestExOutcome:
    """Compute best-ex for a loan against all active investor programs.

    `snapshot` is the canonicalized loan snapshot. The function:
      1. Iterates active cm_investor_programs for the tenant.
      2. Evaluates eligibility (persists a cm_eligibility_results row each).
      3. Computes pricing for each eligible program.
      4. Ranks by net_proceeds desc (with deterministic tie-break).
      5. Persists a cm_best_execution_runs row with the full ranked table.
      6. Returns the chosen program + ranked list.

    Ineligible programs are still ranked (so the audit shows "would have
    been #3 but failed min_fico") with eligibility_passed=False. PoC keeps
    them out of the net_proceeds comparison but in the persisted trace.
    """
    snap_hash = canonical_hash(snapshot)
    snapshot_versions = capture_versions(db)

    # ── Snapshot the rate sheet for the run
    rate_sheet = (
        db.query(RateSheet)
        .filter(
            RateSheet.tenant_id == tenant_id,
            RateSheet.channel == channel,
            RateSheet.status == RateSheetStatus.PUBLISHED,
        )
        .order_by(RateSheet.version.desc())
        .first()
    )
    if rate_sheet is None:
        raise ValueError(f"No published rate sheet for channel={channel!r}")

    # ── Evaluate + price per active program
    candidates: list[RankedInvestor] = []
    programs = (
        db.query(InvestorProgram, Investor)
        .join(Investor, Investor.id == InvestorProgram.investor_id)
        .filter(
            InvestorProgram.tenant_id == tenant_id,
            InvestorProgram.status == "active",
        )
        .all()
    )
    for program, investor in programs:
        # Eligibility (persisted)
        elig_id, elig_outcome = evaluate_and_persist(
            db, tenant_id=tenant_id, loan_id=loan_id,
            investor_program_id=program.id, snapshot=snapshot,
            snapshot_versions=snapshot_versions,
        )
        if not elig_outcome.passed:
            # Record ineligible in the trace but skip the pricing compute
            candidates.append(RankedInvestor(
                rank=0,
                investor_id=investor.id,
                investor_program_id=program.id,
                investor_name=investor.name,
                rate_bps=0.0,
                llpa_total_bps=0.0,
                srp_bps=0.0,
                delivery_fee=0.0,
                net_proceeds=0.0,
                adjusted_price=0.0,
                base_price=float(snapshot.get("loan_amount") or 0),
                eligibility_passed=False,
                failing_rules=[_outcome_to_dict(o) for o in elig_outcome.failing_rules],
                breakdown=[],
            ))
            continue

        # Pricing
        try:
            priced: PricedTerms = price_lock(
                db, tenant_id=tenant_id, snapshot=snapshot,
                srp_schedule=program.srp_schedule if isinstance(program.srp_schedule, dict) else {},
                channel=channel,
            )
        except ValueError as e:
            log.warning("pricing failed for program %s: %s", program.id, e)
            continue

        llpa_total = sum(float(a["value_bps"]) for a in priced.llpa_adjustments)
        candidates.append(RankedInvestor(
            rank=0,
            investor_id=investor.id,
            investor_program_id=program.id,
            investor_name=investor.name,
            rate_bps=priced.rate_bps,
            llpa_total_bps=llpa_total,
            srp_bps=priced.srp_bps,
            delivery_fee=priced.delivery_fee,
            net_proceeds=priced.net_price,
            adjusted_price=priced.adjusted_price,
            base_price=priced.base_price,
            eligibility_passed=True,
            failing_rules=[],
            breakdown=priced.llpa_adjustments,
        ))

    # ── Rank eligible by net_proceeds desc with deterministic tie-break
    eligible = [c for c in candidates if c.eligibility_passed]
    eligible.sort(key=lambda r: (-r.net_proceeds, r.investor_name, str(r.investor_program_id)))
    for i, r in enumerate(eligible, 1):
        r.rank = i

    # Ineligible go at the bottom in their own stable order
    ineligible = [c for c in candidates if not c.eligibility_passed]
    ineligible.sort(key=lambda r: (r.investor_name, str(r.investor_program_id)))
    for r in ineligible:
        r.rank = len(eligible) + 1

    ranked = eligible + ineligible

    if not eligible:
        # No eligible program at all: this is an alertable state. The caller
        # (router) raises an alert with the failing rules of all programs.
        chosen = ineligible[0] if ineligible else None
        variance = 0.0
        rationale = "No investor program passed eligibility for this loan."
    else:
        chosen = eligible[0]
        if len(eligible) > 1:
            variance = chosen.net_proceeds - eligible[1].net_proceeds
        else:
            variance = chosen.net_proceeds
        rationale = (
            f"Chose {chosen.investor_name} on highest net proceeds "
            f"(${chosen.net_proceeds:,.0f}); "
            f"beat #{2 if len(eligible) > 1 else 'N/A'} by ${variance:,.0f}"
        )

    # ── Persist the run row
    from app.models.capital_markets import BestExecutionRun

    run_row = BestExecutionRun(
        tenant_id=tenant_id,
        loan_id=loan_id,
        loan_snapshot_hash=snap_hash,
        loan_snapshot=snapshot,
        rate_sheet_id=rate_sheet.id,
        snapshot_versions=snapshot_versions,
        calc_version=CMCalcVersion.BEST_EX,
        product_code=str(snapshot.get("product_code") or ""),
        lock_period_days=int(snapshot.get("lock_period_days") or 30),
        rate_bps=eligible[0].rate_bps if eligible else 0.0,
        ranked_results=[_ranked_to_dict(r) for r in ranked],
        chosen_investor_program_id=chosen.investor_program_id if chosen else None,
        variance_to_second=variance,
        rationale=rationale,
        evaluated_at=_utcnow(),
    )
    db.add(run_row)
    db.flush()

    return BestExOutcome(
        run_id=run_row.id,
        ranked=ranked,
        chosen=chosen,
        variance_to_second=variance,
        rationale=rationale,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _outcome_to_dict(o) -> dict[str, Any]:
    return {
        "rule_code": o.rule_code,
        "op": o.op,
        "expected": o.expected,
        "observed": o.observed,
        "severity": o.severity,
        "source": o.source,
        "passed": o.passed,
    }


def _ranked_to_dict(r: RankedInvestor) -> dict[str, Any]:
    return {
        "rank": r.rank,
        "investor_id": str(r.investor_id),
        "investor_program_id": str(r.investor_program_id),
        "investor_name": r.investor_name,
        "rate_bps": r.rate_bps,
        "llpa_total_bps": r.llpa_total_bps,
        "srp_bps": r.srp_bps,
        "delivery_fee": r.delivery_fee,
        "net_proceeds": r.net_proceeds,
        "adjusted_price": r.adjusted_price,
        "base_price": r.base_price,
        "eligibility_passed": r.eligibility_passed,
        "failing_rules": r.failing_rules,
        "breakdown": r.breakdown,
        "tie_break_key": TIE_BREAK_ORDER[0],
    }


def _utcnow():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
