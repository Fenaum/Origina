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
  loans, loan_financials, loan_terms, properties, borrowers (+ optional co-borrower),
  conditions (3-5 per loan), loan_status_events (progression history),
  notes (1-3 per loan for submitted+), tasks (1-2 per loan for conditions_review+),
  loan_parties (broker assignment)

Usage:
  cd <repo-root>
  python3 scripts/seed_nonqm_loans.py
"""
import os
import sys
import random
import math
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
    "Alexander", "Mia", "Elijah", "Luna", "Lucas", "Layla", "Logan", "Zoe",
    "Aiden", "Penelope", "Jackson", "Lily", "Sebastian", "Eleanor", "Mateo", "Nora",
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
    "Murphy", "Russell", "Brooks", "Reed", "Kelly", "Simmons", "Foster", "Gray",
]

STREETS = [
    "Oak Lane", "Maple Drive", "Cedar Court", "Pine Street", "Elm Avenue",
    "Willow Way", "Birch Boulevard", "Spruce Road", "Ash Circle", "Walnut Place",
    "Harbor View Drive", "Sunset Boulevard", "Ocean Avenue", "Mountain Road",
    "Valley View Lane", "Lakeside Drive", "Riverside Road", "Hillcrest Avenue",
    "Parkview Circle", "Meadow Lane", "Creekside Drive", "Ridgewood Road",
    "Bayshore Boulevard", "Coastline Drive", "Summit Avenue", "Canyon Road",
    "Orchard Street", "Vineyard Way", "Terrace Drive", "Magnolia Court",
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

EMPLOYERS = [
    "Pacific Coast Ventures LLC", "Summit Financial Group", "Harbor Real Estate LLC",
    "Coastal Properties Inc.", "Mountain Peak Holdings", "Sunrise Capital Partners",
    "Bay Area Consulting Group", "Desert Sun Investments", "Lakewood Enterprises",
    "Ridgeline Development Corp.", "Crestwood Management LLC", "Silverstone Partners",
    "Pacific Rim Trading Co.", "Atlas Property Group", "Horizon Ventures LLC",
    "Keystone Capital Group", "Pinnacle Real Estate LLC", "Blueprint Development",
    "Meridian Holdings Corp.", "Compass Point Investments", "Trident Group LLC",
    "Goldbridge Capital Partners", "Coastal Equity Group", "Premier Holdings Inc.",
]

JOB_TITLES = [
    "Owner", "Principal", "Managing Partner", "CEO", "President", "Director",
    "Real Estate Investor", "Portfolio Manager", "Business Owner", "Consultant",
    "Freelance Contractor", "Independent Broker", "Property Manager",
    "VP of Operations", "Chief Financial Officer", "Managing Director",
]

BROKERAGES = [
    ("Elite Mortgage Wholesale", "elite@mortgagewholesale.com", "800-555-0101"),
    ("Pacific Coast Lending Partners", "info@pclending.com", "800-555-0102"),
    ("National Wholesale Mortgage", "ops@nwmortgage.com", "800-555-0103"),
    ("Premier Broker Network", "loans@premierbroker.com", "800-555-0104"),
    ("Summit Mortgage Wholesale", "submit@summitmtg.com", "800-555-0105"),
    ("Alliance Lending Group", "pipeline@alliancelending.com", "800-555-0106"),
    ("Coastal Capital Wholesale", "wholesale@coastalcap.com", "800-555-0107"),
    ("Paramount Mortgage Partners", "info@paramountmtg.com", "800-555-0108"),
    ("Apex Wholesale Lending", "intake@apexwholesale.com", "800-555-0109"),
    ("Keystone Broker Alliance", "loans@keystonebroker.com", "800-555-0110"),
    ("Broadview Mortgage Wholesale", "ops@broadviewmtg.com", "800-555-0111"),
    ("Horizon Wholesale Lending", "submit@horizonlending.com", "800-555-0112"),
    ("Pacific Mortgage Alliance", "info@pacificmortgage.com", "800-555-0113"),
    ("Cornerstone Broker Group", "pipeline@cornerstonebroker.com", "800-555-0114"),
    ("Vanguard Mortgage Partners", "wholesale@vanguardmtg.com", "800-555-0115"),
]

CONDITIONS_BY_PRODUCT = {
    "dscr": [
        ("Lease Agreement", "Provide executed lease agreement(s) for all rental units."),
        ("Rent Roll", "Provide current rent roll showing all tenants and rents."),
        ("DSCR Calculation Worksheet", "Verify DSCR calculation with appraisal rental income schedule."),
        ("Property Management Agreement", "Provide property management agreement if applicable."),
        ("Landlord Insurance Certificate", "Provide landlord insurance certificate with appropriate coverage."),
        ("Entity Documents", "Provide LLC/corporation formation documents if entity borrower."),
        ("3-Month Reserve Statements", "Provide 3 months of asset statements for reserves verification."),
        ("Operating Account Statements", "Provide 3 months of operating account bank statements."),
    ],
    "bank_statement": [
        ("12-Month Bank Statements", "Provide 12 months of personal/business bank statements."),
        ("CPA Letter", "Provide CPA letter verifying self-employment and business ownership."),
        ("Business License", "Provide current business license for primary business."),
        ("Year-to-Date P&L Statement", "Provide year-to-date profit and loss statement prepared by CPA."),
        ("2 Years Federal Tax Returns", "Provide 2 years of federal tax returns (personal and/or business)."),
        ("Business Ownership Documentation", "Provide articles of incorporation or LLC operating agreement."),
        ("Business Insurance Certificate", "Provide current business insurance certificate or binder."),
        ("60-Day Asset Statements", "Provide 60 days of bank statements for all accounts used for reserves."),
    ],
    "asset_depletion": [
        ("60-Day Asset Statements", "Provide 60 days asset statements for all qualifying accounts."),
        ("Retirement Account Statements", "Provide most recent quarterly retirement account statements."),
        ("Brokerage Portfolio Statement", "Provide brokerage account statements with full asset detail."),
        ("Gift Letter", "Provide gift letter if any portion of assets are gifted funds."),
        ("Asset Liquidation Documentation", "Document plan and ability for asset liquidation to service mortgage."),
        ("CPA Letter — Asset Source", "CPA letter confirming all qualifying assets are unencumbered."),
        ("Custodian Letter", "Letter from asset custodian confirming account balances."),
    ],
    "interest_only": [
        ("Full Income Documentation", "Provide full income documentation per IO product guidelines."),
        ("IO Qualifying Payment Worksheet", "Provide qualifying payment worksheet using fully amortized rate."),
        ("12-Month PITIA Reserve Verification", "Verify 12 months PITIA in reserves post-closing."),
        ("Full Appraisal Review", "Provide full FNMA appraisal review for jumbo IO product."),
        ("Credit Inquiry Explanation Letter", "Written explanation for all credit inquiries in past 12 months."),
        ("Homeowners Insurance Binder", "Provide insurance binder showing required dwelling coverage."),
    ],
    "jumbo_nonqm": [
        ("Full FNMA Appraisal", "Provide full FNMA appraisal (second appraisal required above $2M)."),
        ("Title Commitment", "Provide title commitment with all exceptions reviewed and cleared."),
        ("HOA Budget and Financials", "Provide HOA budget, financials, and meeting minutes if applicable."),
        ("Flood Zone Determination", "Verify flood zone and provide flood insurance if in SFHA."),
        ("Payoff Statement", "Provide payoff statement(s) for all liens being satisfied at closing."),
        ("Current Survey", "Provide current survey if required by title insurer."),
        ("Wire Instructions Confirmation", "Confirm wire instructions and fund disbursement details in writing."),
        ("Jumbo Underwriting Worksheet", "Complete jumbo underwriting worksheet per investor guidelines."),
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

ETHNICITIES = ["Hispanic or Latino", "Not Hispanic or Latino", "Information not provided", "Not applicable"]
ETHNICITY_WEIGHTS = [0.18, 0.70, 0.08, 0.04]

RACES = ["White", "Black or African American", "Asian", "American Indian or Alaska Native",
         "Native Hawaiian or Other Pacific Islander", "Information not provided"]
RACE_WEIGHTS = [0.60, 0.13, 0.17, 0.02, 0.01, 0.07]

GENDERS = ["Male", "Female", "Information not provided"]
GENDER_WEIGHTS = [0.52, 0.42, 0.06]

NOTES_BY_STAGE = {
    "submitted": [
        "File received from broker. Initial review in queue.",
        "Submission package complete. Assigned to processing.",
        "Borrower profile looks strong — FICO and reserves both solid.",
        "Broker called to confirm title company selection.",
        "Ordered 4506-C transcript directly from IRS.",
        "File has been prioritized per AE request.",
    ],
    "conditions_review": [
        "Appraisal ordered from approved AMC. ETA 7-10 business days.",
        "Borrower contacted re: missing bank statements. Expects to upload by EOW.",
        "UW reviewing rent roll — minor inconsistency with appraisal rental schedule.",
        "Condition package sent to borrower via portal. Awaiting response.",
        "Title report received. One open lien identified — working with borrower to resolve.",
        "Insurance binder received and reviewed. Coverage adequate.",
        "CPA letter received. Verified self-employment per guidelines.",
        "Appraisal came in at value. LTV within program limits.",
        "UW requested additional 2 months bank statements for reserves.",
        "Entity documents received and reviewed. LLC in good standing.",
    ],
    "approved": [
        "Loan approved subject to final conditions. Sent approval letter to broker.",
        "Borrower notified of approval. Scheduling closing date.",
        "Clear to close pending final insurance binder update.",
        "Closing disclosure sent. 3-day waiting period starts today.",
        "Rate lock extended 15 days per borrower request.",
        "Title confirmed clear. Closing scheduled with escrow.",
    ],
    "funded": [
        "Loan funded. Wired $% to escrow. Awaiting recording confirmation.",
        "Docs back signed. Notary package complete.",
        "Funding complete. Final conditions cleared by UW.",
        "Recorded in county. Congratulations to the borrower!",
    ],
}

TASKS_BY_STAGE = {
    "conditions_review": [
        ("Order Appraisal", "Order full FNMA appraisal from approved AMC.", "high"),
        ("Collect Insurance Binder", "Request homeowner's insurance binder from borrower's agent.", "normal"),
        ("Verify Employment", "Confirm employment and income with VOE or CPA letter.", "high"),
        ("Request Title Commitment", "Order title commitment from title company.", "normal"),
        ("Collect Bank Statements", "Obtain 12/24 months bank statements from borrower.", "normal"),
        ("Order Flood Cert", "Order flood zone determination certificate.", "low"),
        ("Review Appraisal", "Review completed appraisal for value and condition.", "high"),
        ("Verify Reserves", "Confirm post-closing reserves meet program minimum.", "normal"),
    ],
    "approved": [
        ("Prepare Closing Disclosure", "Generate and send CD to borrower. 3-day waiting period.", "high"),
        ("Confirm Wire Instructions", "Verify wire instructions with escrow/title company.", "urgent"),
        ("Final Insurance Review", "Confirm insurance binder updated with lender as mortgagee.", "normal"),
        ("Schedule Closing", "Coordinate closing date with borrower, title, and broker.", "normal"),
    ],
}

PURPOSE_DETAILS = {
    "purchase": ["Standard purchase", "REO purchase", "Short sale purchase", "New construction purchase"],
    "refinance": ["Rate and term refinance", "Streamline refinance", "No cash-out refinance"],
    "cash_out": ["Debt consolidation", "Home improvement", "Investment acquisition", "Business purpose cash-out"],
}

CASHOUT_TYPES = ["debt_consolidation", "home_improvement", "investment", "business_purpose", "other"]


# ── Helpers ───────────────────────────────────────────────────────────────────
def rand_date(start: date, end: date) -> date:
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def rand_phone() -> str:
    return f"{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"


def rand_postal(state: str) -> str:
    return str(random.randint(10000, 99999))


def rand_ssn4() -> str:
    return f"{random.randint(1000,9999)}"


def rand_dob(min_age=30, max_age=65) -> date:
    years_ago = random.randint(min_age, max_age)
    return date(date.today().year - years_ago, random.randint(1, 12), random.randint(1, 28))


def calc_pi(loan_amount: float, annual_rate: float, term_months: int, payment_type: str) -> float:
    if payment_type == "interest_only":
        return round(loan_amount * (annual_rate / 100) / 12, 2)
    r = (annual_rate / 100) / 12
    if r == 0:
        return round(loan_amount / term_months, 2)
    return round(loan_amount * r / (1 - (1 + r) ** -term_months), 2)


def rand_ethnicity() -> str:
    return random.choices(ETHNICITIES, weights=ETHNICITY_WEIGHTS, k=1)[0]


def rand_race() -> str:
    return random.choices(RACES, weights=RACE_WEIGHTS, k=1)[0]


def rand_gender() -> str:
    return random.choices(GENDERS, weights=GENDER_WEIGHTS, k=1)[0]


# ── Product-specific loan generators ─────────────────────────────────────────
def gen_dscr(tenant_id, admin_id, loan_num):
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(150_000, 2_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.60, 0.80), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_rent = round(loan_amount * random.uniform(0.006, 0.010), 2)
    rate = round(random.uniform(7.00, 9.50), 3)
    pi = calc_pi(loan_amount, rate, 360, "principal_and_interest")
    dscr = round(monthly_rent / pi, 2)
    prop_taxes = round(appraised_value * random.uniform(0.009, 0.015) / 12, 2)
    hoi = round(appraised_value * random.uniform(0.004, 0.007) / 12, 2)
    prop_type = random.choice(["single_family", "condo", "multi_family"])
    hoa = round(random.uniform(300, 700), 0) if prop_type in ("condo",) else 0.0
    escrow = round(prop_taxes + hoi, 2)
    total_pmt = round(pi + escrow + hoa, 2)
    return {
        "product": "dscr",
        "purpose": random.choice(["purchase", "purchase", "refinance", "cash_out"]),
        "loan_amount": loan_amount, "purchase_price": purchase_price,
        "appraised_value": appraised_value, "down_payment": down_payment,
        "ltv": ltv, "cltv": ltv, "fico_score": random.randint(680, 800),
        "debt_to_income": None, "dscr": dscr, "monthly_rent": monthly_rent,
        "monthly_income": monthly_rent * 12 / 12,
        "cash_reserves": round(pi * random.uniform(3, 12), 2),
        "monthly_debt": None,
        "property_taxes": prop_taxes, "homeowners_insurance": hoi,
        "hoa_fees": hoa, "escrow_amount": escrow,
        "principal_and_interest": pi, "total_monthly_payment": total_pmt,
        "rate": rate, "term_months": 360,
        "amortization_type": "fixed", "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "prepayment_penalty": random.choice([True, True, False]),
        "occupancy_type": "investment", "property_type": prop_type,
        "loan_program": "dscr", "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "rental_income", "income_amount": monthly_rent * 12,
        "employment_status": "self_employed",
        "employer": random.choice(EMPLOYERS), "job_title": random.choice(JOB_TITLES),
        "other_income": round(random.uniform(500, 3000), 2) if random.random() < 0.3 else None,
        "current_balance": round(appraised_value * random.uniform(0.4, 0.65), -3) if random.random() < 0.35 else None,
    }


def gen_bank_statement(tenant_id, admin_id, loan_num):
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(200_000, 1_500_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.65, 0.85), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(8_000, 50_000), 2)
    dti = round(random.uniform(28, 48), 2)
    rate = round(random.uniform(7.25, 9.75), 3)
    term = random.choice([360, 360, 300, 240])
    pi = calc_pi(loan_amount, rate, term, "principal_and_interest")
    monthly_debt = round(monthly_income * dti / 100, 2)
    prop_taxes = round(appraised_value * random.uniform(0.009, 0.015) / 12, 2)
    hoi = round(appraised_value * random.uniform(0.004, 0.007) / 12, 2)
    prop_type = random.choice(["single_family", "single_family", "condo", "townhouse"])
    hoa = round(random.uniform(250, 600), 0) if prop_type in ("condo", "townhouse") else (
        round(random.uniform(50, 200), 0) if random.random() < 0.2 else 0.0
    )
    escrow = round(prop_taxes + hoi, 2)
    total_pmt = round(pi + escrow + hoa, 2)
    return {
        "product": "bank_statement",
        "purpose": random.choice(["purchase", "purchase", "refinance", "cash_out"]),
        "loan_amount": loan_amount, "purchase_price": purchase_price,
        "appraised_value": appraised_value, "down_payment": down_payment,
        "ltv": ltv, "cltv": ltv, "fico_score": random.randint(660, 800),
        "debt_to_income": dti, "dscr": None, "monthly_rent": None,
        "monthly_income": monthly_income, "monthly_debt": monthly_debt,
        "cash_reserves": round(monthly_income * random.uniform(2, 8), 2),
        "property_taxes": prop_taxes, "homeowners_insurance": hoi,
        "hoa_fees": hoa, "escrow_amount": escrow,
        "principal_and_interest": pi, "total_monthly_payment": total_pmt,
        "rate": rate, "term_months": term,
        "amortization_type": "fixed", "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "prepayment_penalty": random.choice([True, True, False]),
        "occupancy_type": random.choice(["owner_occupied", "owner_occupied", "investment"]),
        "property_type": prop_type,
        "loan_program": "bank_statement", "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "self_employment", "income_amount": monthly_income * 12,
        "employment_status": "self_employed",
        "employer": random.choice(EMPLOYERS), "job_title": random.choice(JOB_TITLES),
        "other_income": round(random.uniform(500, 2500), 2) if random.random() < 0.25 else None,
        "current_balance": round(appraised_value * random.uniform(0.4, 0.65), -3) if random.random() < 0.4 else None,
    }


def gen_asset_depletion(tenant_id, admin_id, loan_num):
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
    rate = round(random.uniform(6.875, 8.75), 3)
    pi = calc_pi(loan_amount, rate, 360, "principal_and_interest")
    monthly_debt = round(imputed_monthly * dti / 100, 2)
    prop_taxes = round(appraised_value * random.uniform(0.008, 0.013) / 12, 2)
    hoi = round(appraised_value * random.uniform(0.004, 0.006) / 12, 2)
    prop_type = random.choice(["single_family", "condo"])
    hoa = round(random.uniform(400, 900), 0) if prop_type == "condo" else 0.0
    escrow = round(prop_taxes + hoi, 2)
    total_pmt = round(pi + escrow + hoa, 2)
    return {
        "product": "asset_depletion",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount, "purchase_price": purchase_price,
        "appraised_value": appraised_value, "down_payment": down_payment,
        "ltv": ltv, "cltv": ltv, "fico_score": random.randint(700, 820),
        "debt_to_income": dti, "dscr": None, "monthly_rent": None,
        "monthly_income": imputed_monthly, "monthly_debt": monthly_debt,
        "cash_reserves": round(liquid_assets * 0.10, 2),
        "property_taxes": prop_taxes, "homeowners_insurance": hoi,
        "hoa_fees": hoa, "escrow_amount": escrow,
        "principal_and_interest": pi, "total_monthly_payment": total_pmt,
        "rate": rate, "term_months": 360,
        "amortization_type": "fixed", "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "prepayment_penalty": random.choice([True, False]),
        "occupancy_type": random.choice(["owner_occupied", "second_home"]),
        "property_type": prop_type,
        "loan_program": "asset_depletion", "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": "investment_income", "income_amount": imputed_monthly * 12,
        "employment_status": "retired",
        "employer": None, "job_title": None,
        "other_income": round(random.uniform(1000, 8000), 2) if random.random() < 0.5 else None,
        "current_balance": round(appraised_value * random.uniform(0.35, 0.60), -3) if random.random() < 0.45 else None,
    }


def gen_interest_only(tenant_id, admin_id, loan_num):
    state = random.choice(list(CITIES_BY_STATE.keys()))
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(300_000, 2_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.60, 0.80), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(15_000, 80_000), 2)
    dti = round(random.uniform(25, 43), 2)
    rate = round(random.uniform(7.125, 9.0), 3)
    product = random.choice(["30yr_io_10yr", "30yr_io_5yr"])
    pi = calc_pi(loan_amount, rate, 360, "interest_only")
    monthly_debt = round(monthly_income * dti / 100, 2)
    prop_taxes = round(appraised_value * random.uniform(0.009, 0.014) / 12, 2)
    hoi = round(appraised_value * random.uniform(0.004, 0.007) / 12, 2)
    prop_type = random.choice(["single_family", "condo"])
    hoa = round(random.uniform(350, 750), 0) if prop_type == "condo" else 0.0
    escrow = round(prop_taxes + hoi, 2)
    total_pmt = round(pi + escrow + hoa, 2)
    return {
        "product": "interest_only",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount, "purchase_price": purchase_price,
        "appraised_value": appraised_value, "down_payment": down_payment,
        "ltv": ltv, "cltv": ltv, "fico_score": random.randint(700, 820),
        "debt_to_income": dti, "dscr": None, "monthly_rent": None,
        "monthly_income": monthly_income, "monthly_debt": monthly_debt,
        "cash_reserves": round(monthly_income * random.uniform(6, 18), 2),
        "property_taxes": prop_taxes, "homeowners_insurance": hoi,
        "hoa_fees": hoa, "escrow_amount": escrow,
        "principal_and_interest": pi, "total_monthly_payment": total_pmt,
        "rate": rate, "term_months": 360,
        "amortization_type": "interest_only",
        "rate_type": random.choice(["fixed", "adjustable"]),
        "payment_type": "interest_only",
        "prepayment_penalty": random.choice([True, True, False]),
        "occupancy_type": random.choice(["owner_occupied", "investment"]),
        "property_type": prop_type,
        "loan_program": "interest_only", "loan_product": product,
        "state": state, "city": city,
        "income_type": random.choice(["salary", "self_employment", "investment_income"]),
        "income_amount": monthly_income * 12,
        "employment_status": random.choice(["employed", "self_employed"]),
        "employer": random.choice(EMPLOYERS), "job_title": random.choice(JOB_TITLES),
        "other_income": round(random.uniform(1000, 5000), 2) if random.random() < 0.35 else None,
        "current_balance": round(appraised_value * random.uniform(0.40, 0.65), -3) if random.random() < 0.40 else None,
    }


def gen_jumbo_nonqm(tenant_id, admin_id, loan_num):
    state = random.choice(["CA", "NY", "WA", "FL", "CO"])
    city = random.choice(CITIES_BY_STATE[state])
    loan_amount = round(random.uniform(726_200, 3_000_000), -3)
    appraised_value = round(loan_amount / random.uniform(0.55, 0.78), -3)
    purchase_price = round(appraised_value * random.uniform(0.95, 1.05), -3)
    down_payment = purchase_price - loan_amount
    ltv = round((loan_amount / appraised_value) * 100, 2)
    monthly_income = round(random.uniform(20_000, 120_000), 2)
    dti = round(random.uniform(20, 40), 2)
    rate = round(random.uniform(6.75, 8.50), 3)
    pi = calc_pi(loan_amount, rate, 360, "principal_and_interest")
    monthly_debt = round(monthly_income * dti / 100, 2)
    prop_taxes = round(appraised_value * random.uniform(0.008, 0.013) / 12, 2)
    hoi = round(appraised_value * random.uniform(0.004, 0.006) / 12, 2)
    prop_type = random.choice(["single_family", "single_family", "condo"])
    hoa = round(random.uniform(500, 1200), 0) if prop_type == "condo" else 0.0
    escrow = round(prop_taxes + hoi, 2)
    total_pmt = round(pi + escrow + hoa, 2)
    return {
        "product": "jumbo_nonqm",
        "purpose": random.choice(["purchase", "purchase", "refinance"]),
        "loan_amount": loan_amount, "purchase_price": purchase_price,
        "appraised_value": appraised_value, "down_payment": down_payment,
        "ltv": ltv, "cltv": ltv, "fico_score": random.randint(720, 840),
        "debt_to_income": dti, "dscr": None, "monthly_rent": None,
        "monthly_income": monthly_income, "monthly_debt": monthly_debt,
        "cash_reserves": round(monthly_income * random.uniform(6, 24), 2),
        "property_taxes": prop_taxes, "homeowners_insurance": hoi,
        "hoa_fees": hoa, "escrow_amount": escrow,
        "principal_and_interest": pi, "total_monthly_payment": total_pmt,
        "rate": rate, "term_months": 360,
        "amortization_type": "fixed", "rate_type": "fixed",
        "payment_type": "principal_and_interest",
        "prepayment_penalty": random.choice([True, False]),
        "occupancy_type": random.choice(["owner_occupied", "owner_occupied", "second_home"]),
        "property_type": prop_type,
        "loan_program": "jumbo_nonqm", "loan_product": "30yr_fixed",
        "state": state, "city": city,
        "income_type": random.choice(["salary", "self_employment"]),
        "income_amount": monthly_income * 12,
        "employment_status": random.choice(["employed", "self_employed"]),
        "employer": random.choice(EMPLOYERS), "job_title": random.choice(JOB_TITLES),
        "other_income": round(random.uniform(2000, 10000), 2) if random.random() < 0.4 else None,
        "current_balance": round(appraised_value * random.uniform(0.35, 0.60), -3) if random.random() < 0.45 else None,
    }


PRODUCT_GENERATORS = [
    (gen_dscr,            35),
    (gen_bank_statement,  30),
    (gen_asset_depletion, 15),
    (gen_interest_only,   10),
    (gen_jumbo_nonqm,     10),
]
GEN_FUNCS, GEN_WEIGHTS = zip(*PRODUCT_GENERATORS)
GEN_TOTAL = sum(GEN_WEIGHTS)
GEN_PROBS = [w / GEN_TOTAL for w in GEN_WEIGHTS]


# ── Main seeder ───────────────────────────────────────────────────────────────
def run(n: int = 200) -> None:
    conn = psycopg2.connect(DATABASE_URL)
    psycopg2.extras.register_uuid()
    cur = conn.cursor()

    # Fetch tenant and users
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
        sys.exit("ERROR: admin@origina.dev not found. Run bootstrap_user.py first.")
    admin_id = str(row[0])

    cur.execute("SELECT id FROM users WHERE email = 'underwriter@origina.dev' LIMIT 1")
    row = cur.fetchone()
    underwriter_id = str(row[0]) if row else admin_id

    cur.execute("SELECT id FROM users WHERE email = 'processor@origina.dev' LIMIT 1")
    row = cur.fetchone()
    processor_id = str(row[0]) if row else admin_id

    user_pool = [admin_id, underwriter_id, processor_id]

    print(f"Tenant: {tenant_id}")
    print("Wiping existing loans for this tenant …")
    cur.execute("DELETE FROM loans WHERE tenant_id = %s", (tenant_id,))
    deleted = cur.rowcount
    conn.commit()
    print(f"  Removed {deleted} existing loan(s).")

    # Create broker parties
    print("Creating broker parties …")
    broker_party_ids = []
    for name, email, phone in BROKERAGES:
        cur.execute("""
            INSERT INTO parties (tenant_id, party_type, display_name, legal_name, email, phone)
            VALUES (%s, 'company', %s, %s, %s, %s)
            RETURNING id
        """, (tenant_id, name, name, email, phone))
        broker_party_ids.append(str(cur.fetchone()[0]))
    conn.commit()
    print(f"  Created {len(broker_party_ids)} broker parties.")

    print(f"Seeding {n} wholesale Non-QM loans …")

    today = date.today()
    start_date = today - timedelta(days=540)
    inserted = 0

    for i in range(n):
        gen_fn = random.choices(GEN_FUNCS, weights=GEN_PROBS, k=1)[0]
        spec = gen_fn(tenant_id, admin_id, i + 1)
        product = spec["product"]

        # Status and dates
        status = random.choices(STATUSES, weights=STATUS_PROBS, k=1)[0]
        app_date = rand_date(start_date, today - timedelta(days=30))
        submitted_at = app_date + timedelta(days=random.randint(1, 14)) if status != "new_draft" else None
        loan_number = f"LN-NQM-{(i + 1):05d}"

        # Milestone dates
        initial_disc_date = submitted_at + timedelta(days=3) if submitted_at and status not in ("new_draft",) else None
        closing_disc_date = None
        closing_date = None
        funding_date = None
        disbursement_date = None
        if status in ("approved", "funded", "closed"):
            closing_disc_date = submitted_at + timedelta(days=random.randint(18, 35)) if submitted_at else None
        if status in ("funded", "closed"):
            funding_date = closing_disc_date + timedelta(days=random.randint(4, 10)) if closing_disc_date else None
            closing_date = funding_date + timedelta(days=1) if funding_date else None
            disbursement_date = funding_date
        if status == "closed":
            closing_date = funding_date + timedelta(days=random.randint(1, 5)) if funding_date else None

        # Purpose extras
        purpose = spec["purpose"]
        purpose_detail = random.choice(PURPOSE_DETAILS.get(purpose, [""]))
        cashout_type = random.choice(CASHOUT_TYPES) if purpose == "cash_out" else None
        construction_type = random.choice(["existing", "existing", "existing", "new_construction"]) if random.random() < 0.9 else "existing"
        property_use = spec["occupancy_type"]

        # Assigned user (vary across processor/underwriter/admin)
        assigned_to = random.choice(user_pool)

        # Loan insert
        cur.execute("""
            INSERT INTO loans (
                tenant_id, loan_number, status, assigned_to,
                submitted_at, application_date, purpose,
                loan_program, loan_product, occupancy_type, product_data,
                closing_date, funding_date, disbursement_date,
                initial_disclosure_date, closing_disclosure_date,
                purpose_detail, cashout_type, construction_type, property_use
            ) VALUES (%s,%s,%s::loan_status,%s,%s,%s,%s::loan_purpose,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            tenant_id, loan_number, status, assigned_to,
            submitted_at, app_date, purpose,
            spec["loan_program"], spec["loan_product"], spec["occupancy_type"],
            psycopg2.extras.Json({"product": product, "channel": "wholesale"}),
            closing_date, funding_date, disbursement_date,
            initial_disc_date, closing_disc_date,
            purpose_detail, cashout_type, construction_type, property_use,
        ))
        loan_id = str(cur.fetchone()[0])

        # Loan financials
        cur.execute("""
            INSERT INTO loan_financials (
                tenant_id, loan_id,
                loan_amount, purchase_price, appraised_value, down_payment,
                ltv, cltv, fico_score, debt_to_income, dscr,
                cash_reserves, monthly_rent, monthly_income, monthly_debt,
                other_income, principal_and_interest, current_balance,
                escrow_amount, total_monthly_payment,
                property_taxes, homeowners_insurance, hoa_fees
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            tenant_id, loan_id,
            spec["loan_amount"], spec["purchase_price"], spec["appraised_value"], spec["down_payment"],
            spec["ltv"], spec["cltv"], spec["fico_score"],
            spec.get("debt_to_income"), spec.get("dscr"),
            spec.get("cash_reserves"), spec.get("monthly_rent"), spec.get("monthly_income"),
            spec.get("monthly_debt"), spec.get("other_income"),
            spec.get("principal_and_interest"), spec.get("current_balance"),
            spec.get("escrow_amount"), spec.get("total_monthly_payment"),
            spec.get("property_taxes"), spec.get("homeowners_insurance"), spec.get("hoa_fees"),
        ))

        # Loan terms
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
                interest_rate_locked, rate_lock_date, rate_lock_days, lock_expiration_date,
                prepayment_penalty
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            tenant_id, loan_id,
            rate, rate, spec["term_months"],
            spec["amortization_type"], spec["rate_type"], spec["payment_type"],
            locked, lock_date, lock_days, lock_exp,
            spec.get("prepayment_penalty", False),
        ))

        # Property
        state = spec["state"]
        street_num = random.randint(100, 9999)
        street = random.choice(STREETS)
        address2 = f"Unit {random.randint(1, 400)}" if spec["property_type"] in ("condo",) and random.random() < 0.7 else None
        cur.execute("""
            INSERT INTO properties (
                tenant_id, loan_id, is_subject,
                address1, address2, city, state, postal_code,
                property_type, occupancy
            ) VALUES (%s,%s,true,%s,%s,%s,%s,%s,%s,%s)
        """, (
            tenant_id, loan_id,
            f"{street_num} {street}", address2,
            spec["city"], state, rand_postal(state),
            spec["property_type"], spec["occupancy_type"],
        ))

        # Primary borrower address
        b_state = random.choice(list(CITIES_BY_STATE.keys()))
        b_city = random.choice(CITIES_BY_STATE[b_state])
        b_street = f"{random.randint(100, 9999)} {random.choice(STREETS)}"
        cur.execute("""
            INSERT INTO addresses (tenant_id, street1, city, state, postal_code, country)
            VALUES (%s,%s,%s,%s,%s,'US') RETURNING id
        """, (tenant_id, b_street, b_city, b_state, rand_postal(b_state)))
        addr_id = str(cur.fetchone()[0])

        # Primary borrower
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        dob = rand_dob(30, 65)
        is_employed = spec["employment_status"] in ("employed", "self_employed")
        cur.execute("""
            INSERT INTO borrowers (
                tenant_id, loan_id, type, first_name, last_name, ssn_last4, dob,
                phone, email, current_address_id, mailing_address_id,
                income_type, income_amount, employment_status, employer_name, job_title,
                years_on_job, years_in_profession, marital_status, dependents,
                ethnicity, race, gender,
                work_phone, work_email
            ) VALUES (%s,%s,'primary_borrower',%s,%s,%s,%s,%s,%s,%s,%s,
                      %s::borrower_income_type,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            tenant_id, loan_id, first, last, rand_ssn4(), dob,
            rand_phone(),
            f"{first.lower()}.{last.lower()}@example.com",
            addr_id, addr_id,
            spec["income_type"],
            round(spec["income_amount"], 2),
            spec["employment_status"],
            spec["employer"], spec["job_title"],
            random.randint(1, 20), random.randint(5, 25),
            random.choice(["married", "married", "single", "divorced"]),
            random.randint(0, 3),
            rand_ethnicity(), rand_race(), rand_gender(),
            rand_phone() if is_employed else None,
            f"{first.lower()}.{last.lower()}@work.example.com" if is_employed else None,
        ))

        # Co-borrower (~40% of loans)
        if random.random() < 0.40:
            cb_state = random.choice(list(CITIES_BY_STATE.keys()))
            cb_city = random.choice(CITIES_BY_STATE[cb_state])
            cb_street = f"{random.randint(100, 9999)} {random.choice(STREETS)}"
            cur.execute("""
                INSERT INTO addresses (tenant_id, street1, city, state, postal_code, country)
                VALUES (%s,%s,%s,%s,%s,'US') RETURNING id
            """, (tenant_id, cb_street, cb_city, cb_state, rand_postal(cb_state)))
            cb_addr_id = str(cur.fetchone()[0])

            cb_first = random.choice(FIRST_NAMES)
            cb_last = last if random.random() < 0.65 else random.choice(LAST_NAMES)
            cb_dob = rand_dob(28, 70)
            relationship = random.choice(["spouse", "spouse", "business_partner", "other"])
            cb_inc_type = random.choice(["salary", "self_employment", "investment_income", "retirement_income"])
            cb_income = round(random.uniform(3000, 25000) * 12, 2)
            cb_emp_status = "employed" if cb_inc_type == "salary" else ("self_employed" if cb_inc_type == "self_employment" else "retired")
            cb_is_employed = cb_emp_status in ("employed", "self_employed")
            cur.execute("""
                INSERT INTO borrowers (
                    tenant_id, loan_id, type, first_name, last_name, ssn_last4, dob,
                    phone, email, current_address_id, mailing_address_id,
                    borrower_relationship, income_type, income_amount,
                    employment_status, employer_name, job_title,
                    years_on_job, years_in_profession, marital_status, dependents,
                    ethnicity, race, gender, work_phone
                ) VALUES (%s,%s,'co_borrower',%s,%s,%s,%s,%s,%s,%s,%s,
                          %s::borrower_relationship,%s::borrower_income_type,%s,
                          %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                tenant_id, loan_id, cb_first, cb_last, rand_ssn4(), cb_dob,
                rand_phone(),
                f"{cb_first.lower()}.{cb_last.lower()}@example.com",
                cb_addr_id, cb_addr_id,
                relationship, cb_inc_type, cb_income,
                cb_emp_status,
                random.choice(EMPLOYERS) if cb_is_employed else None,
                random.choice(JOB_TITLES) if cb_is_employed else None,
                random.randint(1, 15) if cb_is_employed else None,
                random.randint(3, 20) if cb_is_employed else None,
                "married" if relationship == "spouse" else random.choice(["single", "married", "divorced"]),
                random.randint(0, 2),
                rand_ethnicity(), rand_race(), rand_gender(),
                rand_phone() if cb_is_employed else None,
            ))

        # Conditions
        cond_pool = CONDITIONS_BY_PRODUCT.get(product, CONDITIONS_BY_PRODUCT["bank_statement"])
        n_conds = random.randint(3, min(5, len(cond_pool)))
        selected_conds = random.sample(cond_pool, n_conds)
        for cond_num, (cond_name, cond_desc) in enumerate(selected_conds, 1):
            if status in ("approved", "funded", "closed"):
                cond_status = random.choice(["cleared", "cleared", "waived"])
            elif status == "conditions_review":
                cond_status = random.choice(["open", "open", "submitted"])
            else:
                cond_status = "open"
            cur.execute("""
                INSERT INTO conditions (tenant_id, loan_id, name, description, condition_number, status)
                VALUES (%s,%s,%s,%s,%s,%s::condition_status)
            """, (tenant_id, loan_id, cond_name, cond_desc, cond_num, cond_status))

        # Status event history
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
                ) VALUES (%s,%s,%s::loan_status,%s::loan_status,%s,%s,%s)
            """, (
                tenant_id, loan_id, from_s, to_s,
                reason_map.get(to_s, "Status updated."),
                actor,
                datetime.combine(event_date, datetime.min.time()).replace(tzinfo=timezone.utc),
            ))

        # Notes (for submitted+)
        if status not in ("new_draft",) and submitted_at:
            note_stage = "funded" if status in ("funded", "closed") else (
                "approved" if status == "approved" else (
                    "conditions_review" if status in ("conditions_review", "denied", "withdrawn") else "submitted"
                )
            )
            note_pool = NOTES_BY_STAGE.get(note_stage, NOTES_BY_STAGE["submitted"])
            n_notes = random.randint(1, 3)
            for note_body in random.sample(note_pool, min(n_notes, len(note_pool))):
                note_date = rand_date(submitted_at, min(today, submitted_at + timedelta(days=45)))
                cur.execute("""
                    INSERT INTO notes (tenant_id, loan_id, body, created_by, created_at)
                    VALUES (%s,%s,%s,%s,%s)
                """, (
                    tenant_id, loan_id, note_body,
                    random.choice(user_pool),
                    datetime.combine(note_date, datetime.min.time()).replace(tzinfo=timezone.utc),
                ))

        # Tasks (for conditions_review+)
        if status in ("conditions_review", "approved", "funded", "closed"):
            task_stage = "approved" if status in ("approved", "funded", "closed") else "conditions_review"
            task_pool = TASKS_BY_STAGE.get(task_stage, TASKS_BY_STAGE["conditions_review"])
            n_tasks = random.randint(1, min(2, len(task_pool)))
            for title, desc, priority in random.sample(task_pool, n_tasks):
                if status in ("funded", "closed"):
                    task_status = "done"
                elif status == "approved":
                    task_status = random.choice(["done", "in_progress"])
                else:
                    task_status = random.choice(["todo", "in_progress", "done"])
                due_offset = random.randint(3, 14)
                due_at = datetime.combine(
                    (submitted_at or app_date) + timedelta(days=due_offset),
                    datetime.min.time()
                ).replace(tzinfo=timezone.utc)
                cur.execute("""
                    INSERT INTO tasks (
                        tenant_id, loan_id, title, description, status, priority,
                        assigned_to, created_by, due_at
                    ) VALUES (%s,%s,%s,%s,%s::task_status,%s::task_priority,%s,%s,%s)
                """, (
                    tenant_id, loan_id, title, desc, task_status, priority,
                    random.choice(user_pool), admin_id, due_at,
                ))

        # Broker party assignment
        broker_party_id = random.choice(broker_party_ids)
        cur.execute("""
            INSERT INTO loan_parties (tenant_id, loan_id, party_id, role, is_primary)
            VALUES (%s,%s,%s,'broker'::loan_party_role,true)
        """, (tenant_id, loan_id, broker_party_id))

        inserted += 1
        if inserted % 25 == 0:
            conn.commit()
            print(f"  {inserted}/{n} loans committed …")

    conn.commit()
    conn.close()
    print(f"\nDone — {inserted} wholesale Non-QM loans inserted.")


if __name__ == "__main__":
    run(200)
