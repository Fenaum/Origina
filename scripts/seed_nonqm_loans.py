"""
scripts/seed_nonqm_loans.py

Generates 200 wholesale Non-QM loan records with realistic data spread
across five Non-QM product types:
  - DSCR        (35%)  — investment/rental properties, income from rent
  - Bank Stmt   (30%)  — self-employed borrowers, 12/24-month bank statements
  - Asset Depl  (15%)  — high net worth, income imputed from liquid assets
  - Interest Only (10%) — IO period on jumbo product
  - Jumbo Non-QM (10%) — large balance, non-agency qualifying

Each loan creates records in:
  loans, loan_financials, loan_terms, properties, borrowers (+ addresses),
  conditions (2-4 per loan), loan_status_events (progression history)

Usage:
  cd <repo-root>
  python3 scripts/seed_nonqm_loans.py
"""
import os
import sys
import random
import hashlib
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "backend"))
from dotenv import load_dotenv
load_dotenv()

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL not set. Add to src/backend/.env")

# ── Seed for reproducibility ──────────────────────────────────────────────────
random.seed(42)

# ── Reference data ────────────────────────────────────────────────────────────
FIRST_NAMES = [
    "James", "Maria", "David", "Jennifer", "Michael", "Linda", "Robert", "Patricia",
    "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah",
    "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty",
    "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", "Kevin", "Dorothy",
    "Jason", "Kimberly", "Raymond", "Emily", "Gregory", "Donna", "Frank", "Michelle",
    "Edward", "Carol", "Jonathan", "Amanda", "Patrick", "Melissa", "Brian", "Deborah",
    "Scott", "Stephanie", "Benjamin", "Rebecca", "Andrew", "Laura", "Gary", "Sharon",
    "Samuel", "Cynthia", "Timothy", "Amy", "Jose", "Angela", "Larry", "Helen",
    "Jin", "Wei", "Priya", "Raj", "Amir", "Fatima", "Carlos", "Isabella",
    "Ethan", "Olivia", "Noah", "Emma", "Liam", "Ava", "Mason", "Sophia",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
    "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
    "Campbell", "Mitchell", "Carter", "Roberts", "Chen", "Kim", "Patel", "Singh",
    "Khan", "Ali", "Ahmed", "Park", "Yamamoto", "Tanaka", "Rossi", "Ferrari",
]

STREETS = [
    "Oak Lane", "Maple Drive", "Cedar Court", "Pine Street", "Elm Avenue",
    "Willow Way", "Birch Boulevard", "Spruce Road", "Ash Circle", "Walnut Place",
    "Harbor View Drive", "Sunset Boulevard", "Ocean Avenue", "Mountain Road",
    "Valley View Lane", "Lakeside Drive", "Riverside Road", "Hillcrest Avenue",
    "Parkview Circle", "Meadow Lane", "Creekside Drive", "Ridgewood Road",
    "Bayshore Boulevard", "Coastline Drive", "Summit Avenue", "Canyon Road",
]

CITIES_BY_STATE = {
    "CA": ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Irvine",
           "Riverside", "Fremont", "Long Beach", "Oakland", "Bakersfield"],
    "TX": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth",
            "El Paso", "Arlington", "Plano", "Lubbock", "Irving"],
    "FL": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg",
            "Hialeah", "Tallahassee", "Fort Lauderdale", "Pembroke Pines", "Coral Springs"],
    "NY": ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse",
            "Albany", "New Rochelle", "Mount Vernon", "Schenectady", "Utica"],
    "NV": ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"],
    "AZ": ["Phoenix", "Tucson", "Mesa", "Chandler", "Glendale", "Scottsdale"],
    "CO": ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood"],
    "WA": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kirkland"],
    "GA": ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens"],
    "NC": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem"],
}

PROPERTY_TYPES = [
    "single_family", "single_family", "single_family",  # weighted more
    "condo", "condo",
    "multi_family",
    "townhouse",
    "commercial",
]

EMPLOYERS = [
    "Pacific Coast Ventures LLC", "Summit Financial Group", "Harbor Real Estate LLC",
    "Coastal Properties Inc.", "Mountain Peak Holdings", "Sunrise Capital Partners",
    "Bay Area Consulting Group", "Desert Sun Investments", "Lakewood Enterprises",
    "Ridgeline Development Corp.", "Crestwood Management LLC", "Silverstone Partners",
    "Pacific Rim Trading Co.", "Atlas Property Group", "Horizon Ventures LLC",
    "Keystone Capital Group", "Pinnacle Real Estate LLC", "Blueprint Development",
    "Meridian Holdings Corp.", "Compass Point Investments",
]

JOB_TITLES = [
    "Owner", "Principal", "Managing Partner", "CEO", "President", "Director",
    "Real Estate Investor", "Portfolio Manager", "Business Owner", "Consultant",
    "Freelance Contractor", "Independent Broker", "Property Manager",
]

BROKERAGES = [
    "Elite Mortgage Wholesale", "Pacific Coast Lending Partners", "National Wholesale Mortgage",
    "Premier Broker Network", "Summit Mortgage Wholesale", "Alliance Lending Group",
    "Coastal Capital Wholesale", "Paramount Mortgage Partners", "Apex Wholesale Lending",
    "Keystone Broker Alliance",
]

CONDITIONS_BY_PRODUCT = {
    "dscr": [
        ("Lease Agreement", "Provide executed lease agreement(s) for all rental units."),
        ("Rent Roll", "Provide current rent roll showing all tenants and rents."),
        ("DSCR Calculation", "Verify DSCR calculation with appraisal rental income schedule."),
        ("Property Management Agreement", "Provide property management agreement if applicable."),
        ("Insurance Certificate", "Provide landlord insurance certificate with appropriate coverage."),
        ("Entity Documents", "Provide LLC/corporation formation documents if entity borrower."),
        ("Bank Statements (3 months)", "Provide 3 months of asset statements for reserves verification."),
    ],
    "bank_statement": [
        ("12-Month Bank Statements", "Provide 12 months of personal/business bank statements."),
        ("CPA Letter", "Provide CPA letter verifying self-employment and business ownership."),
        ("Business License", "Provide current business license for primary business."),
        ("P&L Statement", "Provide year-to-date profit and loss statement."),
        ("2 Years Tax Returns", "Provide 2 years of federal tax returns (personal and/or business)."),
        ("Business Ownership Proof", "Provide articles of incorporation or LLC operating agreement."),
        ("Insurance Documentation", "Provide business insurance certificate."),
    ],
    "asset_depletion": [
        ("Asset Statements (60 days)", "Provide 60 days asset statements for all qualifying accounts."),
        ("Retirement Account Statements", "Provide most recent retirement account statements."),
        ("Investment Portfolio Statement", "Provide brokerage account statements with asset detail."),
        ("Gift Letter", "Provide gift letter if any portion of assets are gifted."),
        ("Liquidation Plan", "Document plan for asset liquidation to service mortgage."),
        ("CPA Letter for Asset Source", "CPA letter confirming assets are unencumbered."),
    ],
    "interest_only": [
        ("Income Documentation", "Provide full income documentation per product guidelines."),
        ("IO Qualifying Payment Worksheet", "Provide qualifying payment worksheet using fully amortized rate."),
        ("Reserve Verification", "Verify 12 months PITIA in reserves post-closing."),
        ("Appraisal Review", "Provide full appraisal review for jumbo IO product."),
        ("Credit Explanation Letter", "Written explanation for any credit inquiries in past 12 months."),
    ],
    "jumbo_nonqm": [
        ("Full Appraisal", "Provide full FNMA appraisal (second appraisal may be required above $2M)."),
        ("Title Commitment", "Provide title commitment with all exceptions reviewed."),
        ("HOA Documents", "Provide HOA budget, financials, and meeting minutes if applicable."),
        ("Flood Cert", "Verify flood zone determination and provide flood insurance if required."),
        ("Payoff Statement", "Provide payoff statement(s) for all liens being satisfied."),
        ("Survey", "Provide current survey if required by title."),
        ("Wire Instructions", "Confirm wire instructions and fund disbursement details."),
    ],
}

STATUS_TRANSITIONS = {
    "new_draft":         None,
    "submitted":         "new_draft",
    "conditions_review": "submitted",
    "approved":          "conditions_review",
    "funded":            "approved",
    "closed":            "funded",
    "denied":            "submitted",
    "withdrawn":         "submitted",
}

STATUS_WEIGHTS = [
    ("new_draft",         8),
    ("submitted",         18),
    ("conditions_review", 28),
    ("approved",          22),
    ("funded",            14),
    ("closed",            5),
    ("denied",            3),
    ("withdrawn",         2),
]
STATUSES, STATUS_PROBS = zip(*STATUS_WEIGHTS)
STATUS_PROBS = [w / sum(STATUS_PROBS) for w in STATUS_PROBS]


# ── Helpers ───────────────────────────────────────────────────────────────────
def rand_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))

def rand_phone() -> str:
    return f"{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"

def rand_postal(state: str) -> str:
    return str(random.randint(10000, 99999))

def rand_ssn4() -> str:
    return f"{random.randint(1000,9999)}"

def rand_dob_self_employed() -> date:
    # Typically 35-60 years old
    years_ago = random.randint(35, 60)
    return date(date.today().year - years_ago, random.randint(1, 12), random.randint(1, 28))

def build_product_data(product: str, **kwargs) -> dict:
    return {"product": product, "channel": "wholesale", **kwargs}


# ── Product-specific loan generators ─────────────────────────────────────────
def gen_dscr(tenant_id: str, admin_id: str, loan_num: int) -> dict:
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(150_000, 2_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.60, 0.80), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_rent = round(loan_amount * random.uniform(0.006, 0.010), 2)
    pi = round(loan_amount * (0.00625 / (1 - (1 + 0.00625) ** -360)), 2)  # approx at 7.5%
    dscr = round(monthly_rent / pi, 2)
    fico = random.randint(680, 800)
    rate = round(random.uniform(7.00, 9.50), 3)
    return {
        "product": "dscr",
        "purpose": random.choice(["purchase", "purchase", "refinance", "cash_out"]),
        "loan_amount": loan_amount,
        "purchase_price": purchase_price,
        "appraised_value": appraised_value,
        "down_payment": down_payment,
        "ltv": ltv,
        "cltv": ltv,
        "fico_score": fico,
        "debt_to_income": None,
        "dscr": dscr,
        "monthly_rent": monthly_rent,
        "cash_reserves": round(pi * random.uniform(3, 12), 2),
        "rate": rate,
        "term_months": 360,
        "amortization_type": "fixed",
        "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "occupancy_type": "investment",
        "property_type": random.choice(["single_family", "condo", "multi_family"]),
        "loan_program": "dscr",
        "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "rental_income",
        "income_amount": monthly_rent * 12,
        "employment_status": "self_employed",
        "employer": random.choice(EMPLOYERS),
        "job_title": random.choice(JOB_TITLES),
    }


def gen_bank_statement(tenant_id: str, admin_id: str, loan_num: int) -> dict:
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(200_000, 1_500_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.65, 0.85), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(8_000, 50_000), 2)
    dti = round(random.uniform(28, 48), 2)
    fico = random.randint(660, 800)
    rate = round(random.uniform(7.25, 9.75), 3)
    return {
        "product": "bank_statement",
        "purpose": random.choice(["purchase", "purchase", "refinance", "cash_out"]),
        "loan_amount": loan_amount,
        "purchase_price": purchase_price,
        "appraised_value": appraised_value,
        "down_payment": down_payment,
        "ltv": ltv,
        "cltv": ltv,
        "fico_score": fico,
        "debt_to_income": dti,
        "dscr": None,
        "monthly_rent": None,
        "monthly_income": monthly_income,
        "cash_reserves": round(monthly_income * random.uniform(2, 8), 2),
        "rate": rate,
        "term_months": random.choice([360, 360, 300, 240]),
        "amortization_type": "fixed",
        "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "occupancy_type": random.choice(["owner_occupied", "owner_occupied", "investment"]),
        "property_type": random.choice(["single_family", "single_family", "condo", "townhouse"]),
        "loan_program": "bank_statement",
        "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "self_employment",
        "income_amount": monthly_income * 12,
        "employment_status": "self_employed",
        "employer": random.choice(EMPLOYERS),
        "job_title": random.choice(JOB_TITLES),
    }


def gen_asset_depletion(tenant_id: str, admin_id: str, loan_num: int) -> dict:
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(500_000, 3_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.55, 0.75), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    liquid_assets = round(loan_amount * random.uniform(1.5, 4.0), -3)
    imputed_monthly = round(liquid_assets / 360, 2)
    dti = round(random.uniform(20, 42), 2)
    fico = random.randint(700, 820)
    rate = round(random.uniform(6.875, 8.75), 3)
    return {
        "product": "asset_depletion",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount,
        "purchase_price": purchase_price,
        "appraised_value": appraised_value,
        "down_payment": down_payment,
        "ltv": ltv,
        "cltv": ltv,
        "fico_score": fico,
        "debt_to_income": dti,
        "dscr": None,
        "monthly_rent": None,
        "monthly_income": imputed_monthly,
        "cash_reserves": round(liquid_assets * 0.1, 2),
        "rate": rate,
        "term_months": 360,
        "amortization_type": "fixed",
        "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "occupancy_type": random.choice(["owner_occupied", "second_home"]),
        "property_type": random.choice(["single_family", "condo"]),
        "loan_program": "asset_depletion",
        "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "investment_income",
        "income_amount": imputed_monthly * 12,
        "employment_status": "retired",
        "employer": None,
        "job_title": None,
    }


def gen_interest_only(tenant_id: str, admin_id: str, loan_num: int) -> dict:
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(300_000, 2_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.60, 0.80), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(15_000, 80_000), 2)
    dti = round(random.uniform(25, 43), 2)
    fico = random.randint(700, 820)
    rate = round(random.uniform(7.125, 9.0), 3)
    return {
        "product": "interest_only",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount,
        "purchase_price": purchase_price,
        "appraised_value": appraised_value,
        "down_payment": down_payment,
        "ltv": ltv,
        "cltv": ltv,
        "fico_score": fico,
        "debt_to_income": dti,
        "dscr": None,
        "monthly_rent": None,
        "monthly_income": monthly_income,
        "cash_reserves": round(monthly_income * random.uniform(6, 18), 2),
        "rate": rate,
        "term_months": 360,
        "amortization_type": "interest_only",
        "rate_type": random.choice(["fixed", "adjustable"]),
        "payment_type": "interest_only",
        "occupancy_type": random.choice(["owner_occupied", "investment"]),
        "property_type": random.choice(["single_family", "condo"]),
        "loan_program": "interest_only",
        "loan_product": random.choice(["30yr_io_10yr", "30yr_io_5yr"]),
        "state": state, "city": city,
        "income_type": random.choice(["salary", "self_employment", "investment_income"]),
        "income_amount": monthly_income * 12,
        "employment_status": random.choice(["employed", "self_employed"]),
        "employer": random.choice(EMPLOYERS),
        "job_title": random.choice(JOB_TITLES),
    }


def gen_jumbo_nonqm(tenant_id: str, admin_id: str, loan_num: int) -> dict:
    state = random.choice(["CA", "NY", "WA", "FL", "CO"])
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(726_200, 3_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.55, 0.78), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(20_000, 120_000), 2)
    dti = round(random.uniform(20, 40), 2)
    fico = random.randint(720, 840)
    rate = round(random.uniform(6.75, 8.50), 3)
    return {
        "product": "jumbo_nonqm",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount,
        "purchase_price": purchase_price,
        "appraised_value": appraised_value,
        "down_payment": down_payment,
        "ltv": ltv,
        "cltv": ltv,
        "fico_score": fico,
        "debt_to_income": dti,
        "dscr": None,
        "monthly_rent": None,
        "monthly_income": monthly_income,
        "cash_reserves": round(monthly_income * random.uniform(6, 24), 2),
        "rate": rate,
        "term_months": 360,
        "amortization_type": "fixed",
        "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "occupancy_type": random.choice(["owner_occupied", "owner_occupied", "second_home"]),
        "property_type": random.choice(["single_family", "single_family", "condo"]),
        "loan_program": "jumbo_nonqm",
        "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": random.choice(["salary", "self_employment"]),
        "income_amount": monthly_income * 12,
        "employment_status": random.choice(["employed", "self_employed"]),
        "employer": random.choice(EMPLOYERS),
        "job_title": random.choice(JOB_TITLES),
    }


PRODUCT_GENERATORS = [
    (gen_dscr,          35),
    (gen_bank_statement, 30),
    (gen_asset_depletion, 15),
    (gen_interest_only,  10),
    (gen_jumbo_nonqm,    10),
]
GEN_FUNCS, GEN_WEIGHTS = zip(*PRODUCT_GENERATORS)
GEN_TOTAL = sum(GEN_WEIGHTS)
GEN_PROBS = [w / GEN_TOTAL for w in GEN_WEIGHTS]


# ── Main seeder ───────────────────────────────────────────────────────────────
def run(n: int = 200) -> None:
    conn = psycopg2.connect(DATABASE_URL)
    psycopg2.extras.register_uuid()

    cur = conn.cursor()

    # Fetch tenant and admin user
    cur.execute("SELECT id FROM tenants WHERE name = 'origina-dev' LIMIT 1")
    row = cur.fetchone()
    if not row:
        conn.close()
        sys.exit("ERROR: tenant 'origina-dev' not found. Run db_migrate.sh first.")
    tenant_id = str(row[0])

    cur.execute("SELECT id FROM users WHERE email = 'admin@origina.dev' LIMIT 1")
    row = cur.fetchone()
    if not row:
        conn.close()
        sys.exit("ERROR: admin@origina.dev not found. Run db_migrate.sh first.")
    admin_id = str(row[0])

    cur.execute("SELECT id FROM users WHERE email = 'underwriter@origina.dev' LIMIT 1")
    row = cur.fetchone()
    underwriter_id = str(row[0]) if row else admin_id

    cur.execute("SELECT id FROM users WHERE email = 'processor@origina.dev' LIMIT 1")
    row = cur.fetchone()
    processor_id = str(row[0]) if row else admin_id

    print(f"Tenant: {tenant_id}")
    print(f"Seeding {n} wholesale Non-QM loans …")

    # Base date range: loans originated over the past 18 months
    today = date.today()
    start_date = today - timedelta(days=540)

    inserted = 0
    for i in range(n):
        gen_fn = random.choices(GEN_FUNCS, weights=GEN_PROBS, k=1)[0]
        spec = gen_fn(tenant_id, admin_id, i + 1)
        product = spec["product"]

        # ── Status and dates ──────────────────────────────────────────────────
        status = random.choices(STATUSES, weights=STATUS_PROBS, k=1)[0]
        app_date = rand_date(start_date, today - timedelta(days=30))
        submitted_at = app_date + timedelta(days=random.randint(1, 14)) if status != "new_draft" else None
        loan_number = f"LN-NQM-{(i + 200):05d}"  # start at 200 to avoid seed collisions

        # ── Loan header ───────────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO loans (
                tenant_id, loan_number, status, assigned_to,
                submitted_at, application_date, purpose,
                loan_program, loan_product, occupancy_type, product_data
            ) VALUES (%s, %s, %s::loan_status, %s, %s, %s, %s::loan_purpose, %s, %s, %s, %s)
            RETURNING id
        """, (
            tenant_id, loan_number, status, admin_id,
            submitted_at, app_date, spec["purpose"],
            spec["loan_program"], spec["loan_product"], spec["occupancy_type"],
            psycopg2.extras.Json(build_product_data(product)),
        ))
        loan_id = str(cur.fetchone()[0])

        # ── Loan financials ───────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO loan_financials (
                tenant_id, loan_id,
                loan_amount, purchase_price, appraised_value, down_payment,
                ltv, cltv, fico_score, debt_to_income, dscr,
                cash_reserves, monthly_rent, monthly_income
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id, loan_id,
            spec["loan_amount"], spec["purchase_price"], spec["appraised_value"], spec["down_payment"],
            spec["ltv"], spec["cltv"], spec["fico_score"], spec.get("debt_to_income"), spec.get("dscr"),
            spec.get("cash_reserves"), spec.get("monthly_rent"), spec.get("monthly_income"),
        ))

        # ── Loan terms ────────────────────────────────────────────────────────
        rate = spec["rate"]
        locked = status not in ("new_draft", "submitted")
        lock_date = submitted_at + timedelta(days=random.randint(1, 5)) if locked and submitted_at else None
        lock_days = random.choice([30, 45, 60]) if locked else None
        lock_exp = lock_date + timedelta(days=lock_days) if lock_date and lock_days else None
        cur.execute("""
            INSERT INTO loan_terms (
                tenant_id, loan_id,
                interest_rate, initial_rate, term_months,
                amortization_type, rate_type, payment_type,
                interest_rate_locked, rate_lock_date, rate_lock_days, lock_expiration_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id, loan_id,
            rate, rate, spec["term_months"],
            spec["amortization_type"], spec["rate_type"], spec["payment_type"],
            locked, lock_date, lock_days, lock_exp,
        ))

        # ── Property ─────────────────────────────────────────────────────────
        state = spec["state"]
        street_num = random.randint(100, 9999)
        street = random.choice(STREETS)
        cur.execute("""
            INSERT INTO properties (
                tenant_id, loan_id, is_subject, address1, city, state, postal_code,
                property_type, occupancy
            ) VALUES (%s, %s, true, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id, loan_id,
            f"{street_num} {street}",
            spec["city"], state,
            rand_postal(state),
            spec["property_type"],
            spec["occupancy_type"],
        ))

        # ── Borrower address ──────────────────────────────────────────────────
        b_state = random.choice(list(CITIES_BY_STATE.keys()))
        b_city = random.choice(CITIES_BY_STATE[b_state])
        b_street = f"{random.randint(100, 9999)} {random.choice(STREETS)}"
        cur.execute("""
            INSERT INTO addresses (tenant_id, street1, city, state, postal_code, country)
            VALUES (%s, %s, %s, %s, %s, 'US')
            RETURNING id
        """, (tenant_id, b_street, b_city, b_state, rand_postal(b_state)))
        addr_id = str(cur.fetchone()[0])

        # ── Primary borrower ──────────────────────────────────────────────────
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        dob = rand_dob_self_employed()
        cur.execute("""
            INSERT INTO borrowers (
                tenant_id, loan_id, type, first_name, last_name, ssn_last4, dob,
                phone, email, current_address_id, mailing_address_id,
                income_type, income_amount, employment_status, employer_name, job_title,
                years_on_job, years_in_profession, marital_status, dependents
            ) VALUES (%s, %s, 'primary_borrower', %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s::borrower_income_type, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            tenant_id, loan_id, first, last, rand_ssn4(), dob,
            rand_phone(),
            f"{first.lower()}.{last.lower()}@example.com",
            addr_id, addr_id,
            spec["income_type"],
            round(spec["income_amount"], 2),
            spec["employment_status"],
            spec["employer"],
            spec["job_title"],
            random.randint(1, 20),
            random.randint(5, 25),
            random.choice(["married", "married", "single", "divorced"]),
            random.randint(0, 3),
        ))

        # ── Conditions ────────────────────────────────────────────────────────
        cond_pool = CONDITIONS_BY_PRODUCT.get(product, CONDITIONS_BY_PRODUCT["bank_statement"])
        n_conds = random.randint(2, min(4, len(cond_pool)))
        selected_conds = random.sample(cond_pool, n_conds)
        for cond_num, (cond_name, cond_desc) in enumerate(selected_conds, 1):
            if status in ("approved", "funded", "closed"):
                cond_status = random.choice(["cleared", "cleared", "waived"])
            elif status == "conditions_review":
                cond_status = random.choice(["open", "open", "submitted"])
            else:
                cond_status = "open"
            cur.execute("""
                INSERT INTO conditions (
                    tenant_id, loan_id, name, description, condition_number, status
                ) VALUES (%s, %s, %s, %s, %s, %s::condition_status)
            """, (tenant_id, loan_id, cond_name, cond_desc, cond_num, cond_status))

        # ── Status event history ──────────────────────────────────────────────
        event_chain = []
        s = status
        while STATUS_TRANSITIONS.get(s):
            prev = STATUS_TRANSITIONS[s]
            event_chain.append((prev, s))
            s = prev
        event_chain.reverse()

        event_date = submitted_at or app_date
        for from_s, to_s in event_chain:
            event_date = event_date + timedelta(days=random.randint(3, 21))
            if event_date > today:
                break
            actor = underwriter_id if to_s in ("approved", "denied") else processor_id
            reason_map = {
                "submitted":         "Application submitted by broker.",
                "conditions_review": "Underwriting started; conditions issued.",
                "approved":          "Conditions reviewed; loan approved.",
                "funded":            "Loan documents signed; wire disbursed.",
                "closed":            "Loan recorded; file closed.",
                "denied":            "Loan does not meet program guidelines.",
                "withdrawn":         "Borrower withdrew application.",
            }
            cur.execute("""
                INSERT INTO loan_status_events (
                    tenant_id, loan_id, from_status, to_status, reason, actor_user_id, occurred_at
                ) VALUES (%s, %s, %s::loan_status, %s::loan_status, %s, %s, %s)
            """, (
                tenant_id, loan_id, from_s, to_s,
                reason_map.get(to_s, "Status updated."),
                actor,
                datetime.combine(event_date, datetime.min.time()).replace(tzinfo=timezone.utc),
            ))

        inserted += 1
        if inserted % 25 == 0:
            conn.commit()
            print(f"  {inserted}/{n} loans committed …")

    conn.commit()
    conn.close()
    print(f"\nDone — {inserted} wholesale Non-QM loans inserted.")


if __name__ == "__main__":
    run(200)
