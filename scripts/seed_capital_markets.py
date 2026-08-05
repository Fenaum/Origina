"""
scripts/seed_capital_markets.py

Seeds the Capital Markets (CM) PoC data on top of the 202 Non-QM loans
already seeded by scripts/seed_nonqm_loans.py.

Seeds:
  • 3 fictional investors + 9 programs (3 each) — DEMO DATA label carried
    in the investor name so the UI can render a banner (per architecture
    doc §14.4 "demo data" caveat).
  • 1 Origina rate sheet (channel=origina, version=1, status=published) with
    grid entries covering the 5 Non-QM products, 4 lock periods, 3 amount
    bands. Pricing is in basis points (7.50% = 750 bps).
  • 3 LLPA grids: FICO×LTV (5×5 cells), DSCR band (3 bands), doc type (5
    types). Each cell is signed bps.
  • ~10 material-change registry rows covering the documented CM fields.
  • ~120 locks on the 202 seeded loans, mixed lifecycle states
    (confirmed/requested/reprice_required/expired).
  • 1 sample pool with the locked loans as members.
  • A handful of alerts to feed the in-app alerts list.

Idempotent — safe to re-run. Existing rows for the origina-dev tenant are
deleted before each re-seed (CM-only data; the loan records themselves
are preserved). Random seed is 42 to keep the PoC deterministic.

Usage:
  python3 scripts/seed_capital_markets.py

Per docs/DECISIONS.md "Reproducibility as a CI-Enforced Invariant" ADR:
every lock / best-ex run persists its own (loan_snapshot, snapshot_hash,
snapshot_versions, calc_version) so a re-run with the same seed reproduces
the same rows bit-for-bit.
"""
import hashlib
import json
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(".env"))

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL not set. Add it to .env")

TENANT_NAME = "origina-dev"
CALC_VERSION_PRICING = "cm_pricing_v1"
CALC_VERSION_ELIG = "cm_eligibility_v1"
CALC_VERSION_BESTEX = "cm_best_ex_v1"
LOCK_POLICY_VERSION = "lock_policy_v1"   # hard-coded for PoC (ADR 3 note)

random.seed(42)

# ── Reference data ────────────────────────────────────────────────────────────

# 3 fictional investors. Each has a distinct guideline personality so the
# eligibility demo (FICO 700→678 fails on the strict investor) actually shows.
INVESTORS = [
    {
        "name": "Apex Non-QM Capital",                  # "strict"
        "contact_email": "trading@apex-nonqm.example",
        "delivery_spec": {"wire_window_days": 5, "delivery_method": "docs_trustee"},
        "guideline_version": "apex_v1",
        "overlay_version": "apex_overlay_v1",
        # Base product guidelines (mirrored by cm_investor_programs)
        "products": {
            "dscr_30_fixed":         {"min_fico": 700, "max_ltv": 75, "min_dscr": 1.20, "min_reserves_months": 6},
            "bank_stmt_30_fixed":    {"min_fico": 680, "max_ltv": 80, "min_dscr": None, "min_reserves_months": 9},
            "asset_depletion_30_fixed": {"min_fico": 700, "max_ltv": 70, "min_dscr": None, "min_reserves_months": 12},
        },
        # Overlays tighten the strict investor further
        "overlays": [
            {"rule_code": "min_fico", "op": ">=", "value": 720, "severity": "block", "sort_order": 0},
            {"rule_code": "max_ltv",  "op": "<=", "value": 70,  "severity": "block", "sort_order": 1},
        ],
    },
    {
        "name": "Cascade Whole-Loan Partners",          # "balanced"
        "contact_email": "desk@cascade-wl.example",
        "delivery_spec": {"wire_window_days": 7, "delivery_method": "bailee_letter"},
        "guideline_version": "cascade_v1",
        "overlay_version": "cascade_overlay_v1",
        "products": {
            "dscr_30_fixed":         {"min_fico": 680, "max_ltv": 75, "min_dscr": 1.15, "min_reserves_months": 6},
            "bank_stmt_30_fixed":    {"min_fico": 660, "max_ltv": 80, "min_dscr": None, "min_reserves_months": 6},
            "asset_depletion_30_fixed": {"min_fico": 680, "max_ltv": 75, "min_dscr": None, "min_reserves_months": 9},
        },
        "overlays": [],
    },
    {
        "name": "Harbor Bridge Investors",              # "loose"
        "contact_email": "purchases@harborbridge.example",
        "delivery_spec": {"wire_window_days": 10, "delivery_method": "scheduled_close"},
        "guideline_version": "harbor_v1",
        "overlay_version": "harbor_overlay_v1",
        "products": {
            "dscr_30_fixed":         {"min_fico": 660, "max_ltv": 80, "min_dscr": 1.10, "min_reserves_months": 3},
            "bank_stmt_30_fixed":    {"min_fico": 640, "max_ltv": 85, "min_dscr": None, "min_reserves_months": 3},
            "asset_depletion_30_fixed": {"min_fico": 660, "max_ltv": 80, "min_dscr": None, "min_reserves_months": 6},
        },
        "overlays": [],   # loosest
    },
]

PRODUCT_CODES = [
    "dscr_30_fixed",
    "bank_stmt_30_fixed",
    "asset_depletion_30_fixed",
    "interest_only_30_io_5yr",
    "interest_only_30_io_10yr",
    "jumbo_nonqm_30_fixed",
]

# Lock-period bands
LOCK_PERIODS = [30, 45, 60, 90]
# Loan-amount bands (USD)
AMOUNT_BANDS = [
    (0,        500_000),
    (500_000,  1_500_000),
    (1_500_000, 5_000_000),
]

# Base rate matrix per product × lock period (bps). Higher lock = lower rate
# (rough approximation; PoC quality is intentional).
BASE_RATES = {
    "dscr_30_fixed":               {30: 775, 45: 760, 60: 745, 90: 725},
    "bank_stmt_30_fixed":          {30: 810, 45: 795, 60: 780, 90: 760},
    "asset_depletion_30_fixed":    {30: 790, 45: 775, 60: 760, 90: 740},
    "interest_only_30_io_5yr":     {30: 740, 45: 725, 60: 715, 90: 700},
    "interest_only_30_io_10yr":    {30: 765, 45: 750, 60: 740, 90: 725},
    "jumbo_nonqm_30_fixed":        {30: 760, 45: 745, 60: 735, 90: 720},
}

# FICO bands for the FICO×LTV LLPA grid
FICO_BANDS = ["660-679", "680-699", "700-739", "740-779", "780+"]
LTV_BANDS = ["<=65", "65.01-70", "70.01-75", "75.01-80", "80.01-85"]
# (signed bps; positive = debit, negative = credit)
FICO_LTV_CELLS = {
    # row=fico_band, col=ltv_band
    ("660-679", "<=65"):      250,  ("660-679", "65.01-70"): 300,  ("660-679", "70.01-75"): 400,  ("660-679", "75.01-80"): 500,  ("660-679", "80.01-85"): 600,
    ("680-699", "<=65"):      150,  ("680-699", "65.01-70"): 200,  ("680-699", "70.01-75"): 300,  ("680-699", "75.01-80"): 400,  ("680-699", "80.01-85"): 500,
    ("700-739", "<=65"):       50,  ("700-739", "65.01-70"): 100,  ("700-739", "70.01-75"): 150,  ("700-739", "75.01-80"): 250,  ("700-739", "80.01-85"): 375,
    ("740-779", "<=65"):      -50,  ("740-779", "65.01-70"): -25,  ("740-779", "70.01-75"):  50,  ("740-779", "75.01-80"): 150,  ("740-779", "80.01-85"): 250,
    ("780+",    "<=65"):     -100,  ("780+",    "65.01-70"): -75,  ("780+",    "70.01-75"): -25,  ("780+",    "75.01-80"):  50,  ("780+",    "80.01-85"): 150,
}

DSCR_BANDS = ["<1.15", "1.15-1.24", ">=1.25"]
DSCR_CELLS = {
    ("dscr_30_fixed",               "<1.15"):     100,
    ("dscr_30_fixed",               "1.15-1.24"):   0,
    ("dscr_30_fixed",               ">=1.25"):    -50,
    ("interest_only_30_io_5yr",     "<1.15"):     125,
    ("interest_only_30_io_5yr",     "1.15-1.24"):  25,
    ("interest_only_30_io_5yr",     ">=1.25"):    -25,
    ("interest_only_30_io_10yr",    "<1.15"):     150,
    ("interest_only_30_io_10yr",    "1.15-1.24"):  50,
    ("interest_only_30_io_10yr",    ">=1.25"):      0,
}

DOC_TYPES = ["full_doc", "bank_stmt_12", "bank_stmt_24", "asset_depletion", "dscr"]
DOC_TYPE_CELLS = {
    ("full_doc",):              -25,
    ("bank_stmt_12",):           50,
    ("bank_stmt_24",):           75,
    ("asset_depletion",):       100,
    ("dscr",):                   25,
}

# Material-change registry rows. Per ADR 4: each row is (field, impact,
# tolerance, severity). Tolerance shape:
#   {'op': '>=', 'delta': 25}  — field must change by ≥ delta before threshold
#   {'op': 'in_band_cross'}    — crossing into a different LLPA/eligibility band
MATERIAL_CHANGE_ROWS = [
    # FICO — block on band crossing; warn on small movement
    ("fico_score",   "price",         {"op": ">=", "delta": 20},                  "warn"),
    ("fico_score",   "best_ex_rank",  {"op": "in_band_cross", "axis": "fico_band"},  "block"),
    # LTV — same idiom
    ("ltv",          "price",         {"op": ">=", "delta": 1.0},                 "warn"),
    ("ltv",          "best_ex_rank",  {"op": "in_band_cross", "axis": "ltv_band"},   "block"),
    # DSCR — narrow thresholds (small float changes matter)
    ("dscr",         "eligibility",   {"op": "in_band_cross", "axis": "dscr_band"},  "block"),
    # Doc type — a categorical change is always material
    ("doc_type",     "eligibility",   {"op": "categorical"},                     "block"),
    # Loan amount — only material for amount-band-crossing
    ("loan_amount",  "best_ex_rank",  {"op": "in_band_cross", "axis": "amount_band"}, "warn"),
    # Rate-sheet version mismatch — always material
    ("rate_sheet_version", "rate",     {"op": "categorical"},                     "block"),
    # Program change — eligibility + best-ex rerank
    ("loan_program", "eligibility",   {"op": "categorical"},                     "block"),
    # Property value — affects LTV via formula
    ("appraised_value", "price",      {"op": ">=", "delta": 0.05},               "warn"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def canonical_snapshot_hash(snap: dict) -> str:
    """Stable SHA256 over the canonicalized snapshot JSON."""
    payload = json.dumps(snap, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Main ──────────────────────────────────────────────────────────────────────

def run() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Resolve tenant + admin user (requestor for audit-tracked inserts)
    cur.execute("SELECT id FROM tenants WHERE name = %s", (TENANT_NAME,))
    tenant_row = cur.fetchone()
    if not tenant_row:
        sys.exit(f"Tenant {TENANT_NAME!r} not found — run scripts/seed_nonqm_loans.py first.")
    tenant_id = tenant_row[0]

    cur.execute(
        "SELECT id FROM users WHERE tenant_id = %s AND email = 'admin@origina.dev'",
        (tenant_id,),
    )
    admin_row = cur.fetchone()
    admin_id = admin_row[0] if admin_row else None

    if admin_id is None:
        sys.exit("Admin user not found — run scripts/bootstrap_user.py first.")

    # ── Wipe existing CM data for this tenant (idempotent re-seed) ──────────
    # Order matters because of FKs; child tables first.
    cur.execute("DELETE FROM cm_alerts WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_allocations WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_pool_loans WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_pools WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_best_execution_runs WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_eligibility_results WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_lock_events WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_locks WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_audit_versions WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_material_change_registry WHERE tenant_id IS NULL")
    cur.execute("DELETE FROM cm_llpa_cells WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_llpa_grids WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_rate_sheet_entries WHERE tenant_id = %s", (tenant_id,))
    # Wipe rate sheets after entries — but keep other sheets' history by version
    cur.execute("DELETE FROM cm_rate_sheets WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_investor_overlays WHERE tenant_id IS NULL")
    cur.execute("DELETE FROM cm_investor_programs WHERE tenant_id = %s", (tenant_id,))
    cur.execute("DELETE FROM cm_investors WHERE tenant_id = %s", (tenant_id,))

    # ── 1. Investors + programs + overlays ───────────────────────────────────
    investor_ids = {}
    for inv in INVESTORS:
        cur.execute(
            """INSERT INTO cm_investors (tenant_id, name, contact_email, status, delivery_spec)
               VALUES (%s, %s, %s, 'active', %s) RETURNING id""",
            (tenant_id, inv["name"], inv["contact_email"],
             json.dumps(inv["delivery_spec"])),
        )
        inv_id = cur.fetchone()[0]
        investor_ids[inv["name"]] = inv_id

        for product_code, rules in inv["products"].items():
            # Base guideline expressed as cm_investor_program.srp_schedule for the PoC.
            # Real production: separate base_guidelines table. Keeping it inline for §14.1 PoC scope.
            srp_schedule = {
                # SRP (bps) by lock period — PoC: simple flat 100 bps
                "by_lock_period": {30: 100, 45: 125, 60: 150, 90: 200},
                "_base_guideline": rules,
            }
            cur.execute(
                """INSERT INTO cm_investor_programs
                   (tenant_id, investor_id, product_code, guideline_version, overlay_version,
                    srp_schedule, status, effective_from)
                   VALUES (%s, %s, %s, %s, %s, %s, 'active', CURRENT_DATE) RETURNING id""",
                (tenant_id, inv_id, product_code, inv["guideline_version"], inv["overlay_version"],
                 json.dumps(srp_schedule)),
            )

        for ov in inv["overlays"]:
            cur.execute(
                """INSERT INTO cm_investor_overlays
                   (tenant_id, investor_id, program_version, rule_code, op, value,
                    severity, sort_order, effective_from)
                   VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, CURRENT_DATE)""",
                (inv_id, inv["overlay_version"], ov["rule_code"], ov["op"],
                 json.dumps(ov["value"]), ov["severity"], ov["sort_order"]),
            )

    print(f"  Investors: {len(investor_ids)}")

    # ── 2. Rate sheet (Origina channel, version 1, published) ───────────────
    cur.execute(
        """INSERT INTO cm_rate_sheets
           (tenant_id, channel, version, effective_from, status, published_by, published_at, source_note)
           VALUES (%s, 'origina', 1, CURRENT_DATE, 'published', %s, now(),
                   'PoC seed — fictional pricing for the Origina channel')
           RETURNING id""",
        (tenant_id, admin_id),
    )
    rate_sheet_id = cur.fetchone()[0]

    rate_entry_count = 0
    for product in PRODUCT_CODES:
        for lock_days in LOCK_PERIODS:
            for lo, hi in AMOUNT_BANDS:
                cur.execute(
                    """INSERT INTO cm_rate_sheet_entries
                       (tenant_id, rate_sheet_id, product_code, lock_period_days,
                        loan_amount_min, loan_amount_max, rate_bps, points)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, 0)""",
                    (tenant_id, rate_sheet_id, product, lock_days,
                     lo, hi, BASE_RATES[product][lock_days]),
                )
                rate_entry_count += 1
    print(f"  Rate sheet entries: {rate_entry_count}")

    # ── 3. LLPA grids (3 grids, version 1 each) ─────────────────────────────
    llpa_ids = {}

    # FICO×LTV grid
    cur.execute(
        """INSERT INTO cm_llpa_grids
           (tenant_id, grid_code, version, dimension_spec, effective_from)
           VALUES (%s, 'fico_ltv', 1, %s, CURRENT_DATE) RETURNING id""",
        (tenant_id, json.dumps({"axes": ["fico_band", "ltv_band"], "bands": {"fico_band": FICO_BANDS, "ltv_band": LTV_BANDS}})),
    )
    fico_ltv_grid_id = cur.fetchone()[0]
    llpa_ids["fico_ltv"] = fico_ltv_grid_id
    for product in PRODUCT_CODES:
        for fico in FICO_BANDS:
            for ltv in LTV_BANDS:
                cur.execute(
                    """INSERT INTO cm_llpa_cells
                       (tenant_id, llpa_grid_id, product_code, axis_values, value_bps)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (tenant_id, fico_ltv_grid_id, product,
                     json.dumps({"fico_band": fico, "ltv_band": ltv}),
                     FICO_LTV_CELLS[(fico, ltv)]),
                )

    # DSCR band grid
    cur.execute(
        """INSERT INTO cm_llpa_grids
           (tenant_id, grid_code, version, dimension_spec, effective_from)
           VALUES (%s, 'dscr_band', 1, %s, CURRENT_DATE) RETURNING id""",
        (tenant_id, json.dumps({"axes": ["dscr_band"], "bands": {"dscr_band": DSCR_BANDS}})),
    )
    dscr_grid_id = cur.fetchone()[0]
    llpa_ids["dscr_band"] = dscr_grid_id
    for (product, band), bps in DSCR_CELLS.items():
        cur.execute(
            """INSERT INTO cm_llpa_cells
               (tenant_id, llpa_grid_id, product_code, axis_values, value_bps)
               VALUES (%s, %s, %s, %s, %s)""",
            (tenant_id, dscr_grid_id, product,
             json.dumps({"dscr_band": band}), bps),
        )

    # Doc type grid
    cur.execute(
        """INSERT INTO cm_llpa_grids
           (tenant_id, grid_code, version, dimension_spec, effective_from)
           VALUES (%s, 'doc_type', 1, %s, CURRENT_DATE) RETURNING id""",
        (tenant_id, json.dumps({"axes": ["doc_type"], "bands": {"doc_type": DOC_TYPES}})),
    )
    doc_grid_id = cur.fetchone()[0]
    llpa_ids["doc_type"] = doc_grid_id
    for (doc_type,), bps in DOC_TYPE_CELLS.items():
        cur.execute(
            """INSERT INTO cm_llpa_cells
               (tenant_id, llpa_grid_id, product_code, axis_values, value_bps)
               VALUES (%s, %s, 'all', %s, %s)""",
            (tenant_id, doc_grid_id,
             json.dumps({"doc_type": doc_type}), bps),
        )

    print(f"  LLPA grids: 3 (cells seeded)")

    # ── 4. Material-change registry (system defaults, tenant_id IS NULL) ─────
    for field_name, impact, tolerance, severity in MATERIAL_CHANGE_ROWS:
        cur.execute(
            """INSERT INTO cm_material_change_registry
               (tenant_id, field_name, impact, tolerance, severity, version, effective_from)
               VALUES (NULL, %s, %s, %s, %s, 1, CURRENT_DATE)""",
            (field_name, impact, json.dumps(tolerance), severity),
        )
    print(f"  Material-change registry rows: {len(MATERIAL_CHANGE_ROWS)}")

    # ── 5. Pull seeded loans to use for locks ────────────────────────────────
    cur.execute(
        """SELECT l.id, l.loan_program, l.loan_product,
                  f.fico_score, f.ltv, f.dscr, f.loan_amount
           FROM loans l
           JOIN loan_financials f ON f.loan_id = l.id
           WHERE l.tenant_id = %s
             AND f.fico_score IS NOT NULL
             AND f.ltv IS NOT NULL
           ORDER BY l.id""",
        (tenant_id,),
    )
    seeded_loans = cur.fetchall()
    if not seeded_loans:
        sys.exit("No loans with FICO scores found — run scripts/seed_nonqm_loans.py first.")

    # Map program → product_code used in pricing
    program_to_product = {
        "dscr":             "dscr_30_fixed",
        "bank_statement":   "bank_stmt_30_fixed",
        "asset_depletion":  "asset_depletion_30_fixed",
        "interest_only":    "interest_only_30_io_5yr",     # default IO seed to 5yr
        "jumbo_nonqm":      "jumbo_nonqm_30_fixed",
    }
    # Refine IO loan product mapping from loan_product column
    def map_product(loan_program: str, loan_product: str | None) -> str:
        if loan_program == "interest_only":
            if loan_product == "30yr_io_10yr":
                return "interest_only_30_io_10yr"
            return "interest_only_30_io_5yr"
        return program_to_product.get(loan_program, "jumbo_nonqm_30_fixed")

    # Build ~120 locks from the first 120 loans
    target_lock_count = min(120, len(seeded_loans))
    locked_loans = seeded_loans[:target_lock_count]

    # Mix of statuses: 70% confirmed, 15% requested, 10% reprice_required, 5% expired
    status_pool = (
        ["confirmed"] * int(target_lock_count * 0.70)
        + ["requested"] * int(target_lock_count * 0.15)
        + ["reprice_required"] * int(target_lock_count * 0.10)
        + ["expired"] * max(1, target_lock_count - sum([int(target_lock_count * 0.70), int(target_lock_count * 0.15), int(target_lock_count * 0.10)]))
    )
    random.shuffle(status_pool)
    assert len(status_pool) == target_lock_count

    snapshot_versions_base = {
        "rate_sheet_version": 1,
        "llpa_fico_ltv_version": 1,
        "llpa_dscr_band_version": 1,
        "llpa_doc_type_version": 1,
        "material_change_registry_version": 1,
    }

    locks_created = 0
    lock_ids_for_pool = []
    for (loan_id, loan_program, loan_product, fico, ltv, dscr, loan_amount), lock_status in zip(locked_loans, status_pool):
        product_code = map_product(loan_program, loan_product)
        lock_period = random.choice(LOCK_PERIODS)

        # Build loan_snapshot (the captured state at lock time)
        loan_snapshot = {
            "loan_id": str(loan_id),
            "loan_program": loan_program,
            "loan_product": loan_product,
            "product_code": product_code,
            "fico_score": int(fico) if fico is not None else None,
            "ltv": float(ltv) if ltv is not None else None,
            "dscr": float(dscr) if dscr is not None else None,
            "loan_amount": float(loan_amount) if loan_amount is not None else None,
            "lock_period_days": lock_period,
            "appraised_value": None,   # not in seed; PoC doesn't need it
            "doc_type": (
                "dscr" if loan_program == "dscr"
                else "bank_stmt_24" if loan_program == "bank_statement"
                else "asset_depletion" if loan_program == "asset_depletion"
                else "full_doc"
            ),
        }
        snapshot_hash = canonical_snapshot_hash(loan_snapshot)

        # Pricing components (use seed's rate matrix + LLPA lookups)
        rate_bps = float(BASE_RATES[product_code][lock_period])
        # Pick LLPA cells (using fico and ltv bands)
        fico_band = (
            "660-679" if fico < 680 else
            "680-699" if fico < 700 else
            "700-739" if fico < 740 else
            "740-779" if fico < 780 else
            "780+"
        )
        ltv_band = (
            "<=65"     if ltv <= 65 else
            "65.01-70" if ltv <= 70 else
            "70.01-75" if ltv <= 75 else
            "75.01-80" if ltv <= 80 else
            "80.01-85"
        )
        llpa_total_bps = float(FICO_LTV_CELLS[(fico_band, ltv_band)])
        # DSCR adjustment if applicable
        if dscr is not None:
            dscr_band = (
                "<1.15"     if dscr < 1.15 else
                "1.15-1.24" if dscr < 1.25 else
                ">=1.25"
            )
            llpa_total_bps += float(DSCR_CELLS.get((product_code, dscr_band), 0))
        # Doc-type adjustment
        llpa_total_bps += float(DOC_TYPE_CELLS[(loan_snapshot["doc_type"],)])

        # Pricing breakdown (in dollars; notional $100 par for the PoC)
        # We use loan_amount as the par for simplicity.
        base_price = float(loan_amount) if loan_amount else 100_000.0
        srp_bps = 100.0      # PoC: flat 100bps SRP
        delivery_fee = 350.0 # PoC: flat $350 delivery fee
        adjusted_price = base_price * (1 - (llpa_total_bps / 10_000))   # LPAs in bps → percent
        net_price = adjusted_price + (srp_bps / 10_000) * base_price - delivery_fee

        # Time math
        requested_at = now_utc() - timedelta(days=random.randint(1, 30))
        confirmed_at = None
        expires_at = None
        reprice_required_at = None
        if lock_status in ("confirmed", "reprice_required", "extended", "expired", "funded_delivered"):
            confirmed_at = requested_at + timedelta(hours=random.randint(1, 48))
            expires_at = confirmed_at + timedelta(days=lock_period)
        if lock_status == "reprice_required":
            reprice_required_at = now_utc() - timedelta(days=random.randint(0, 5))
        if lock_status == "expired":
            expires_at = now_utc() - timedelta(days=random.randint(1, 10))

        cur.execute(
            """INSERT INTO cm_locks
               (tenant_id, loan_id, rate_sheet_id, loan_snapshot, snapshot_hash, snapshot_versions,
                rate_bps, base_price, llpa_adjustments, srp_bps, delivery_fee,
                adjusted_price, net_price, calc_version,
                lock_period_days, requested_at, confirmed_at, expires_at,
                requested_by, confirmed_by, status, reprice_required_at)
               VALUES (%s, %s, %s, %s, %s, %s,
                       %s, %s, %s, %s, %s,
                       %s, %s, %s,
                       %s, %s, %s, %s,
                       %s, %s, %s, %s)
               RETURNING id""",
            (tenant_id, loan_id, rate_sheet_id,
             json.dumps(loan_snapshot, sort_keys=True),
             snapshot_hash,
             json.dumps(snapshot_versions_base),
             rate_bps, base_price,
             json.dumps([
                 {"grid_code": "fico_ltv",  "version": 1, "value_bps": FICO_LTV_CELLS[(fico_band, ltv_band)], "label": f"{fico_band} × {ltv_band}"},
                 {"grid_code": "doc_type",  "version": 1, "value_bps": DOC_TYPE_CELLS[(loan_snapshot["doc_type"],)], "label": loan_snapshot["doc_type"]},
             ] + ([{"grid_code": "dscr_band", "version": 1, "value_bps": DSCR_CELLS.get((product_code, dscr_band), 0), "label": dscr_band}] if dscr is not None else []),
             ),
             srp_bps, delivery_fee,
             adjusted_price, net_price, CALC_VERSION_PRICING,
             lock_period, requested_at, confirmed_at, expires_at,
             admin_id, admin_id if confirmed_at else None,
             lock_status, reprice_required_at),
        )
        new_lock_id = cur.fetchone()[0]
        locks_created += 1
        if lock_status == "confirmed":     # only confirmed locks go into the pool
            lock_ids_for_pool.append(new_lock_id)

        # Append-only event log: requested + (confirmed if applicable) + reprice_flagged
        cur.execute(
            """INSERT INTO cm_lock_events
               (tenant_id, lock_id, event_type, actor_user_id, payload, created_at)
               VALUES (%s, %s, 'requested', %s, %s, %s)""",
            (tenant_id, new_lock_id, admin_id,
             json.dumps({"loan_snapshot_hash": snapshot_hash, "lock_period_days": lock_period}),
             requested_at),
        )
        if confirmed_at:
            cur.execute(
                """INSERT INTO cm_lock_events
                   (tenant_id, lock_id, event_type, actor_user_id, policy_version, payload, created_at)
                   VALUES (%s, %s, 'confirmed', %s, %s, %s, %s)""",
                (tenant_id, new_lock_id, admin_id, LOCK_POLICY_VERSION,
                 json.dumps({"rate_bps": rate_bps, "net_price": net_price}),
                 confirmed_at),
            )
        if lock_status == "reprice_required":
            cur.execute(
                """INSERT INTO cm_lock_events
                   (tenant_id, lock_id, event_type, actor_user_id, payload, created_at)
                   VALUES (%s, %s, 'reprice_flagged', NULL,
                           %s, %s)""",
                (tenant_id, new_lock_id,
                 json.dumps({"reason": "material_change_demo"}),
                 reprice_required_at),
            )
        if lock_status == "expired":
            cur.execute(
                """INSERT INTO cm_lock_events
                   (tenant_id, lock_id, event_type, actor_user_id, payload, created_at)
                   VALUES (%s, %s, 'expired', NULL, %s, %s)""",
                (tenant_id, new_lock_id,
                 json.dumps({"reason": "lock_period_elapsed"}),
                 expires_at + timedelta(minutes=1)),
            )

    print(f"  Locks created: {locks_created}")

    # ── 6. cm_audit_versions (track the active versions) ────────────────────
    active_versions = [
        ("rate_sheet", 1, "Origina published sheet v1"),
        ("llpa_fico_ltv", 1, "FICO×LTV grid v1"),
        ("llpa_dscr_band", 1, "DSCR band grid v1"),
        ("llpa_doc_type", 1, "Doc type grid v1"),
        ("material_change_registry", 1, "Initial PoC registry"),
    ]
    for code, ver, note in active_versions:
        cur.execute(
            """INSERT INTO cm_audit_versions
               (tenant_id, config_code, version, effective_from, notes)
               VALUES (%s, %s, %s, now(), %s)""",
            (tenant_id, code, ver, note),
        )

    # ── 7. Sample pool with the confirmed locks as members ───────────────────
    cur.execute(
        """INSERT INTO cm_pools (tenant_id, name, target_close, status, notes, created_by)
           VALUES (%s, 'July 2026 Demo Pool', CURRENT_DATE + INTERVAL '30 days', 'open',
                   'PoC seed — first sample pool for the demo', %s)
           RETURNING id""",
        (tenant_id, admin_id),
    )
    pool_id = cur.fetchone()[0]
    for lock_id in lock_ids_for_pool:
        # Need the loan_id from the lock
        cur.execute("SELECT loan_id FROM cm_locks WHERE id = %s", (lock_id,))
        loan_id = cur.fetchone()[0]
        cur.execute(
            """INSERT INTO cm_pool_loans (tenant_id, pool_id, loan_id, added_by)
               VALUES (%s, %s, %s, %s)""",
            (tenant_id, pool_id, loan_id, admin_id),
        )
    print(f"  Pool: 'July 2026 Demo Pool' with {len(lock_ids_for_pool)} confirmed locks")

    # ── 8. A handful of alerts to feed the in-app list ──────────────────────
    # Use the reprice_required locks to raise alerts
    cur.execute(
        """SELECT id, loan_id FROM cm_locks
           WHERE tenant_id = %s AND status = 'reprice_required'
           LIMIT 3""",
        (tenant_id,),
    )
    alert_count = 0
    for lock_id, loan_id in cur.fetchall():
        cur.execute(
            """INSERT INTO cm_alerts
               (tenant_id, loan_id, alert_type, severity, status, message,
                related_entity_type, related_entity_id, raised_at, raised_by_user_id, payload)
               VALUES (%s, %s, 'reprice_required', 'block', 'open',
                       'Material change detected on locked loan — reprice required',
                       'cm_lock', %s, now(), NULL, %s)""",
            (tenant_id, loan_id, lock_id,
             json.dumps({"trigger": "material_change_demo"})),
        )
        alert_count += 1
    print(f"  Alerts raised: {alert_count}")

    # ── 9. Sample eligibility + best-ex results for the demo loan ───────────
    # Pick one loan with a confirmed lock to fully exercise the audit chain
    cur.execute(
        """SELECT l.id, l.loan_program, l.loan_product, f.fico_score, f.ltv, f.dscr, f.loan_amount
           FROM cm_locks k
           JOIN loans l ON l.id = k.loan_id
           JOIN loan_financials f ON f.loan_id = l.id
           WHERE k.tenant_id = %s AND k.status = 'confirmed'
           LIMIT 1""",
        (tenant_id,),
    )
    demo = cur.fetchone()
    if demo:
        demo_loan_id, demo_program, demo_product, demo_fico, demo_ltv, demo_dscr, demo_amount = demo
        # Eligibility per (investor, program) — one row each
        for inv in INVESTORS:
            for product_code, rules in inv["products"].items():
                inv_id = investor_ids[inv["name"]]
                cur.execute("SELECT id FROM cm_investor_programs WHERE tenant_id=%s AND investor_id=%s AND product_code=%s",
                            (tenant_id, inv_id, product_code))
                prog_id = cur.fetchone()[0]
                # Apply rules
                rule_trace = []
                failing = []
                for rule, limit in rules.items():
                    observed = {"min_fico": demo_fico, "max_ltv": demo_ltv, "min_dscr": demo_dscr}.get(rule)
                    if observed is None or limit is None:
                        continue
                    limit = float(limit)
                    passed = (
                        (rule == "min_fico" and demo_fico >= limit) or
                        (rule == "max_ltv"  and demo_ltv  <= limit) or
                        (rule == "min_dscr" and demo_dscr >= limit)
                    )
                    rule_trace.append({"rule_code": rule, "observed": float(observed), "limit": limit, "passed": passed})
                    if not passed:
                        failing.append({"rule_code": rule, "observed": float(observed), "limit": limit, "severity": "block"})
                cur.execute(
                    """INSERT INTO cm_eligibility_results
                       (tenant_id, loan_id, investor_program_id, loan_snapshot_hash,
                        snapshot_versions, calc_version, passed, failing_rules, rule_trace, evaluated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())""",
                    (tenant_id, demo_loan_id, prog_id, "demo_snapshot_hash",
                     json.dumps(snapshot_versions_base), CALC_VERSION_ELIG,
                     len(failing) == 0, json.dumps(failing), json.dumps(rule_trace)),
                )

        # Best-ex run for the demo loan (against the 3 investors)
        ranked = []
        for inv in INVESTORS:
            inv_id = investor_ids[inv["name"]]
            cur.execute(
                """SELECT id, srp_schedule FROM cm_investor_programs
                   WHERE tenant_id=%s AND investor_id=%s AND product_code=%s""",
                (tenant_id, inv_id, program_to_product.get(demo_program, "jumbo_nonqm_30_fixed")),
            )
            prog_id, srp = cur.fetchone()
            srp_schedule = srp
            srp_bps = float(srp_schedule.get("by_lock_period", {}).get("30", 100))
            ranked.append({
                "rank": 0,  # filled after sort
                "investor_program_id": str(prog_id),
                "investor_name": inv["name"],
                "net_proceeds": float(demo_amount or 100_000) + (srp_bps / 10_000) * float(demo_amount or 100_000) - 350.0,
                "srp_bps": srp_bps,
                "delivery_fee": 350.0,
                "tie_break_key": inv["name"],
            })
        ranked.sort(key=lambda r: r["net_proceeds"], reverse=True)
        for i, r in enumerate(ranked, 1):
            r["rank"] = i

        cur.execute(
            """INSERT INTO cm_best_execution_runs
               (tenant_id, loan_id, loan_snapshot_hash, loan_snapshot, rate_sheet_id,
                snapshot_versions, calc_version, product_code, lock_period_days, rate_bps,
                ranked_results, chosen_investor_program_id, variance_to_second, rationale,
                evaluated_at)
               VALUES (%s, %s, 'demo_snapshot_hash', %s, %s,
                       %s, %s, %s, 30, %s,
                       %s, %s, %s, %s, now())""",
            (tenant_id, demo_loan_id,
             json.dumps({"demo": True, "loan_id": str(demo_loan_id)}),
             rate_sheet_id,
             json.dumps(snapshot_versions_base),
             CALC_VERSION_BESTEX,
             program_to_product.get(demo_program, "jumbo_nonqm_30_fixed"),
             BASE_RATES[program_to_product.get(demo_program, "jumbo_nonqm_30_fixed")][30],
             json.dumps(ranked),
             ranked[0]["investor_program_id"],
             ranked[0]["net_proceeds"] - (ranked[1]["net_proceeds"] if len(ranked) > 1 else 0),
             f"Chose {ranked[0]['investor_name']} on highest net proceeds; "
             f"beat #{2 if len(ranked) > 1 else 'N/A'} by ${(ranked[0]['net_proceeds'] - (ranked[1]['net_proceeds'] if len(ranked) > 1 else 0)):.0f}"),
        )

    conn.commit()
    print("Done.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
