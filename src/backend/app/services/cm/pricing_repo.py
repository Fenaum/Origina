"""CM pricing service.

Per ADR "Lock as Artifact (Not a Mutable Loan Status)" + ADR "Calculation
Ownership Map": pricing is computed from the locked snapshot, never from
live loan data. This module holds the SINGLE pricing implementation for
the PoC; UI reads persisted `cm_locks.net_price` and never recomputes.

Pricing formula (PoC §14.1):
  base_price     = par price (use loan_amount as par for the PoC)
  rate_bps       = rate from rate-sheet entry matching product × lock_period × amount band
  llpa_adjust    = sum of LLPA cell bps (FICO×LTV + DSCR band + doc_type)
  adjusted_price = base_price * (1 - sum_llpa_bps / 10_000)
  srp_bps        = servicing-released premium from investor program (per lock period)
  delivery_fee   = flat $350 for the PoC
  net_price      = adjusted_price + (srp_bps / 10_000) * base_price - delivery_fee

Outputs include the priced terms AND the llpa_adjustments list (each entry
references its grid_code + version + value_bps + label) so the persisted
row can be replayed end-to-end without re-querying the grids.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.capital_markets import (
    InvestorProgram,
    LlpaCell,
    LlpaGrid,
    LockEventType,
    RateSheet,
    RateSheetEntry,
    RateSheetStatus,
)
from app.services.cm.constants import CMCalcVersion, CMEventType


# ── Lookup helpers ────────────────────────────────────────────────────────────


@dataclass
class PricedTerms:
    rate_sheet_id: str
    rate_sheet_version: int
    rate_bps: float
    base_price: float
    llpa_adjustments: list[dict[str, Any]]
    srp_bps: float
    delivery_fee: float
    adjusted_price: float
    net_price: float
    calc_version: str


def get_rate_sheet_entry(
    db: Session, *, tenant_id, channel: str, product_code: str,
    lock_period_days: int, loan_amount: float,
) -> RateSheetEntry | None:
    """Return the published rate-sheet entry matching the product / period / amount band.

    The PoC picks the smallest amount band whose max ≥ loan_amount; this is
    a deterministic approximation that matches what the seed ships (3 bands:
    0-500K, 500K-1.5M, 1.5M-5M).
    """
    return (
        db.query(RateSheetEntry)
        .join(RateSheet, RateSheet.id == RateSheetEntry.rate_sheet_id)
        .filter(
            RateSheet.tenant_id == tenant_id,
            RateSheet.channel == channel,
            RateSheet.status == RateSheetStatus.PUBLISHED,
            RateSheetEntry.product_code == product_code,
            RateSheetEntry.lock_period_days == lock_period_days,
            RateSheetEntry.loan_amount_min <= loan_amount,
            RateSheetEntry.loan_amount_max >= loan_amount,
        )
        .order_by(RateSheetEntry.loan_amount_min.desc())
        .first()
    )


def _llpa_cells(
    db: Session, *, tenant_id, grid_code: str, product_code: str, axis_values: dict[str, Any],
) -> list[LlpaCell]:
    """Return all LLPA cells for a (grid, product, axis_values) tuple. There
    will normally be 0 or 1 (FICO×LTV is one cell per combination), but DSCR
    band + doc type may overlap, so we filter by full axis match.
    """
    rows = (
        db.query(LlpaCell)
        .join(LlpaGrid, LlpaGrid.id == LlpaCell.llpa_grid_id)
        .filter(
            LlpaGrid.tenant_id == tenant_id,
            LlpaGrid.grid_code == grid_code,
            LlpaCell.product_code == product_code,
        )
        .all()
    )
    matched = []
    for row in rows:
        if not isinstance(row.axis_values, dict):
            continue
        if all(row.axis_values.get(k) == v for k, v in axis_values.items()):
            matched.append(row)
    return matched


# ── Public API ────────────────────────────────────────────────────────────────


def price_lock(
    db: Session, *, tenant_id, snapshot: dict[str, Any],
    srp_schedule: dict[str, Any], channel: str = "origina",
) -> PricedTerms:
    """Compute pricing from a loan snapshot.

    `snapshot` is the canonicalized loan state (see services/cm/snapshot.py).
    `srp_schedule` is the investor program's SRP schedule jsonb. Returns
    `PricedTerms` (a dataclass, not a SQLAlchemy row) — callers persist
    the result on a cm_locks row.

    Raises ValueError when the rate-sheet entry cannot be found (no matching
    band, product not in the sheet, etc.) — callers translate to 422.
    """
    product_code = snapshot.get("product_code") or _product_code_from_snapshot(snapshot)
    lock_period_days = int(snapshot.get("lock_period_days") or 30)
    loan_amount = float(snapshot.get("loan_amount") or 0)

    entry = get_rate_sheet_entry(
        db, tenant_id=tenant_id, channel=channel, product_code=product_code,
        lock_period_days=lock_period_days, loan_amount=loan_amount,
    )
    if entry is None:
        raise ValueError(
            f"No rate-sheet entry for product={product_code!r} "
            f"period={lock_period_days}d amount=${loan_amount:,.0f}"
        )

    rate_bps = float(entry.rate_bps)
    base_price = float(loan_amount)

    # Sum LLPAs across the three grids
    llpa_adjustments: list[dict[str, Any]] = []
    llpa_total_bps = 0.0

    # FICO×LTV
    fico = snapshot.get("fico_score")
    ltv = snapshot.get("ltv")
    if fico is not None and ltv is not None:
        fico_band = _fico_band(float(fico))
        ltv_band = _ltv_band(float(ltv))
        cells = _llpa_cells(
            db, tenant_id=tenant_id, grid_code="fico_ltv", product_code=product_code,
            axis_values={"fico_band": fico_band, "ltv_band": ltv_band},
        )
        for c in cells:
            llpa_total_bps += float(c.value_bps)
            llpa_adjustments.append({
                "grid_code": "fico_ltv",
                "grid_version": int(c.llpa_grid.version),
                "value_bps": float(c.value_bps),
                "label": f"{fico_band} × {ltv_band}",
            })

    # DSCR band
    dscr = snapshot.get("dscr")
    if dscr is not None:
        dscr_band = _dscr_band(float(dscr))
        cells = _llpa_cells(
            db, tenant_id=tenant_id, grid_code="dscr_band", product_code=product_code,
            axis_values={"dscr_band": dscr_band},
        )
        for c in cells:
            llpa_total_bps += float(c.value_bps)
            llpa_adjustments.append({
                "grid_code": "dscr_band",
                "grid_version": int(c.llpa_grid.version),
                "value_bps": float(c.value_bps),
                "label": dscr_band,
            })

    # Doc type
    doc_type = snapshot.get("doc_type") or "full_doc"
    cells = _llpa_cells(
        db, tenant_id=tenant_id, grid_code="doc_type", product_code="all",
        axis_values={"doc_type": doc_type},
    )
    for c in cells:
        llpa_total_bps += float(c.value_bps)
        llpa_adjustments.append({
            "grid_code": "doc_type",
            "grid_version": int(c.llpa_grid.version),
            "value_bps": float(c.value_bps),
            "label": doc_type,
        })

    srp_bps = float(srp_schedule.get("by_lock_period", {}).get(str(lock_period_days), 100))
    delivery_fee = 350.0

    adjusted_price = base_price * (1 - (llpa_total_bps / 10_000.0))
    net_price = adjusted_price + (srp_bps / 10_000.0) * base_price - delivery_fee

    return PricedTerms(
        rate_sheet_id=str(entry.rate_sheet_id),
        rate_sheet_version=int(entry.rate_sheet.version),
        rate_bps=rate_bps,
        base_price=base_price,
        llpa_adjustments=llpa_adjustments,
        srp_bps=srp_bps,
        delivery_fee=delivery_fee,
        adjusted_price=adjusted_price,
        net_price=net_price,
        calc_version=CMCalcVersion.PRICING,
    )


# ── Band classifiers (mirrors the seeded grid cell coordinates) ───────────────


def _fico_band(fico: float) -> str:
    if fico < 680:  return "660-679"
    if fico < 700:  return "680-699"
    if fico < 740:  return "700-739"
    if fico < 780:  return "740-779"
    return "780+"


def _ltv_band(ltv: float) -> str:
    if ltv <= 65:    return "<=65"
    if ltv <= 70:    return "65.01-70"
    if ltv <= 75:    return "70.01-75"
    if ltv <= 80:    return "75.01-80"
    return "80.01-85"


def _dscr_band(dscr: float) -> str:
    if dscr < 1.15:  return "<1.15"
    if dscr < 1.25:  return "1.15-1.24"
    return ">=1.25"


def _product_code_from_snapshot(snapshot: dict[str, Any]) -> str:
    """Reverse the seed's program→product map when product_code wasn't in the snapshot."""
    program = snapshot.get("loan_program")
    product = snapshot.get("loan_product")
    table = {
        "dscr":             "dscr_30_fixed",
        "bank_statement":   "bank_stmt_30_fixed",
        "asset_depletion":  "asset_depletion_30_fixed",
        "jumbo_nonqm":      "jumbo_nonqm_30_fixed",
        "interest_only":    (
            "interest_only_30_io_10yr" if product == "30yr_io_10yr"
            else "interest_only_30_io_5yr"
        ),
    }
    return table.get(program, "jumbo_nonqm_30_fixed")
