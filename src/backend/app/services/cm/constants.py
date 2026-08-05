"""CM-side constants — kept inside the CM package per the Milestone-1 PIN 1
standalone constraint. CM event-type strings are added to the existing
domain_events.event_type CHECK constraint by migration 141_cm_domain_events
.sql. The strings live here (the Python single source of truth for callers),
not in app.models.events.
"""
from __future__ import annotations


class CMEventType:
    LOCK_CONFIRMED       = "cm.lock.confirmed"
    LOCK_REPRICE_FLAGGED = "cm.lock.reprice_flagged"
    LOCK_REPRICED        = "cm.lock.repriced"
    LOCK_EXPIRED         = "cm.lock.expired"
    LOCK_CANCELLED       = "cm.lock.cancelled"
    MATERIAL_CHANGE      = "cm.material_change"
    ELIGIBILITY_LOST     = "cm.eligibility_lost"
    BEST_EX_RUN          = "cm.best_ex_run"
    ALLOCATION_CREATED   = "cm.allocation_created"

    ALL: frozenset[str] = frozenset({
        LOCK_CONFIRMED, LOCK_REPRICE_FLAGGED, LOCK_REPRICED,
        LOCK_EXPIRED, LOCK_CANCELLED, MATERIAL_CHANGE,
        ELIGIBILITY_LOST, BEST_EX_RUN, ALLOCATION_CREATED,
    })


class CMCalcVersion:
    """Calc versions baked into every persisted decision for ADR 8
       reproducibility. Bump when the math changes (CI gate fails if
       persisted results don't match the replay of the same snapshot +
       same calc_version)."""
    PRICING    = "cm_pricing_v1"
    ELIGIBILITY = "cm_eligibility_v1"
    BEST_EX    = "cm_best_ex_v1"


# Default policy version for lock lifecycle events (PoC: hard-coded per ADR 3).
LOCK_POLICY_VERSION = "lock_policy_v1"

# Margin floor for the below-margin-floor alert (PoC: hard-coded). Phase 3 lifts
# this to a per-tenant config row keyed by program/loan type.
MARGIN_FLOOR_BPS = 25.0   # minimum LLPA debit before the best-ex net is "below floor"

# Tie-break order for best-ex ranking (per §14.1 — explicit for determinism).
# Stable: higher net proceeds wins; ties broken by alphabetically smaller
# investor name; second tie broken by smaller investor_program_id.
TIE_BREAK_ORDER = ("net_proceeds_desc", "investor_name_asc", "investor_program_id_asc")
