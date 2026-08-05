"""Loan-snapshot helpers.

Per ADR "Lock as Artifact (Not a Mutable Loan Status)" + ADR "Reproducibility
as a CI-Enforced Invariant": every priced decision (lock / best-ex /
eligibility) captures a `loan_snapshot` jsonb and a stable `snapshot_hash`
of the canonicalized JSON. The hash is the staleness detector (a fresh
hash of the live loan vs the lock's stored hash = "the loan changed since
the lock was confirmed") AND the replay key (recompute pricing from the
snapshot, not from live data).

Hashes are SHA-256 of `json.dumps(snap, sort_keys=True, separators=(',', ':'))`.
This is intentionally separate from any loan-level hash because the
canonicalization rules are CM-defined (what subset of fields, in what
order). Future changes to canonicalization get a new `calc_version` on
the persisted row, so old rows still replay against their old rules.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

# Fields the CM subsystem cares about for pricing / eligibility / material-change
# detection. Anything not in this list is irrelevant for CM decisions and is
# intentionally dropped from the snapshot to keep replay deterministic.
#
# Per ADR 4 (Material-Change Registry): this is the universe the watcher
# watches. Adding a field here expands the watchable surface for ALL
# investors at once — register the field in cm_material_change_registry
# to give it an impact classification.
SNAPSHOT_FIELDS: tuple[str, ...] = (
    "loan_id",
    "loan_program",
    "loan_product",
    "loan_amount",
    "appraised_value",
    "purchase_price",
    "ltv",
    "cltv",
    "fico_score",
    "debt_to_income",
    "dscr",
    "cash_reserves",
    "monthly_rent",
    "monthly_income",
    "monthly_debt",
    "doc_type",
    "lock_period_days",
)


def _normalize(value: Any) -> Any:
    """Make a value JSON-roundtrip-safe (decimals → str, UUID/date/datetime → iso).

    Done so that callers can pass raw ORM rows without thinking about
    psycopg2's Decimal handling. The canonicalization rule is part of the
    hash contract — don't change without bumping calc_version."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        # Two ways to canonicalize Decimals: string (lossless) or float
        # (lossy but compact). We use string to keep precision in the snapshot;
        # the replay function will parse back to Decimal.
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def capture_snapshot(loan: Any, financials: Any | None, terms: Any | None,
                     lock_period_days: int, doc_type: str | None = None) -> dict[str, Any]:
    """Build the canonical snapshot dict from ORM objects.

    `loan` is a Loan ORM row; `financials` is a LoanFinancials row (may be
    None); `terms` is a LoanTerms row (may be None); `lock_period_days`
    is the prospective lock period; `doc_type` is derived from loan_program
    when not provided (DSCR → 'dscr', bank_statement → 'bank_stmt_24', ...).
    """
    derived_doc_type = doc_type or _infer_doc_type(getattr(loan, "loan_program", None))
    snap: dict[str, Any] = {}
    for f in SNAPSHOT_FIELDS:
        if f == "loan_id":
            snap[f] = _normalize(getattr(loan, "id", None))
            continue
        if f == "loan_program":
            snap[f] = _normalize(getattr(loan, "loan_program", None))
            continue
        if f == "loan_product":
            snap[f] = _normalize(getattr(loan, "loan_product", None))
            continue
        if f == "doc_type":
            snap[f] = derived_doc_type
            continue
        if f == "lock_period_days":
            snap[f] = int(lock_period_days)
            continue
        # Everything else lives on loan_financials
        snap[f] = _normalize(getattr(financials, f, None)) if financials else None
    return snap


def _infer_doc_type(loan_program: str | None) -> str:
    if loan_program == "dscr":
        return "dscr"
    if loan_program == "bank_statement":
        return "bank_stmt_24"
    if loan_program == "asset_depletion":
        return "asset_depletion"
    if loan_program == "interest_only":
        return "full_doc"
    if loan_program == "jumbo_nonqm":
        return "full_doc"
    return "full_doc"


def canonical_hash(snapshot: dict[str, Any]) -> str:
    """Stable SHA-256 of the canonicalized snapshot. Same input → same hash.
    This is the replay key (ADR 8) AND the staleness detector (ADR 4).
    """
    payload = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def capture_versions(db: Any) -> dict[str, int]:
    """Snapshot the active version of every CM config artifact.

    Stored alongside every priced decision (per ADR 8). For the PoC, the
    seed script populates cm_audit_versions — this reads the current row
    per config_code with effective_to IS NULL. New tenants start with empty
    versions; the pricing/eligibility/best-ex services still work but
    snapshot_versions is `{}` (callers can detect that and warn).
    """
    from app.models.capital_markets import AuditVersion
    rows = (
        db.query(AuditVersion)
        .filter(AuditVersion.effective_to.is_(None))
        .all()
    )
    return {r.config_code: int(r.version) for r in rows}
