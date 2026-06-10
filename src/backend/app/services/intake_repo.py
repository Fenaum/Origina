from typing import Callable

from app.schemas.intake_schema import ProgramRecommendationOut

PROGRAMS = [
    "dscr",
    "bank_statement",
    "asset_depletion",
    "full_doc",
    "foreign_national",
    "interest_only",
]

PROGRAM_DEFINITIONS = {
    "dscr": {
        "title": "DSCR Loan",
        "tagline": "Qualify using your property's rental income instead of personal income.",
        "rate_range_label": "Typically in the 7% to 9% range",
        "doc_requirements": [
            "Lease agreement or rent schedule",
            "DSCR ratio at or above program minimum",
            "PITI reserve documentation",
        ],
        "suitability_note": "Ideal for real estate investors with rental property cash flow.",
    },
    "bank_statement": {
        "title": "Bank Statement Loan",
        "tagline": "Use deposit history instead of tax returns to support qualifying income.",
        "rate_range_label": "Typically in the 7.5% to 10% range",
        "doc_requirements": [
            "12 or 24 months of bank statements",
            "CPA letter for business accounts",
            "Business ownership documentation",
        ],
        "suitability_note": "Built for business owners whose tax returns may understate income.",
    },
    "asset_depletion": {
        "title": "Asset Depletion",
        "tagline": "Convert savings and investments into qualifying monthly income.",
        "rate_range_label": "Typically in the 7.5% to 9.5% range",
        "doc_requirements": [
            "Asset statements",
            "Liquid or retirement account balances",
            "Reserve verification",
        ],
        "suitability_note": "Designed for retirees and high-net-worth borrowers with substantial assets.",
    },
    "full_doc": {
        "title": "Full Documentation",
        "tagline": "Use traditional employment and income documentation for a Non-QM path.",
        "rate_range_label": "Typically in the 6.75% to 8.75% range",
        "doc_requirements": [
            "Paystubs and W-2s",
            "Employment history",
            "Asset and reserve statements",
        ],
        "suitability_note": "Best for borrowers with consistent W-2 income and straightforward documentation.",
    },
    "foreign_national": {
        "title": "Foreign National",
        "tagline": "Explore financing options for borrowers without traditional U.S. credit.",
        "rate_range_label": "Typically in the 8% to 11% range",
        "doc_requirements": [
            "Passport or visa documentation",
            "Foreign credit or reference letters",
            "Asset and reserve documentation",
        ],
        "suitability_note": "Useful when the borrower has international income or limited U.S. credit depth.",
    },
    "interest_only": {
        "title": "Interest Only",
        "tagline": "Lower the initial monthly payment with an interest-only structure.",
        "rate_range_label": "Typically in the 7.25% to 9.75% range",
        "doc_requirements": [
            "Qualifying income documentation",
            "Higher reserve verification",
            "Strong credit profile",
        ],
        "suitability_note": "A fit for larger loans where payment flexibility matters and reserves are strong.",
    },
}


def _credit_min(answers: dict[str, str]) -> int:
    return {
        "580_619": 580,
        "620_659": 620,
        "660_699": 660,
        "700_739": 700,
        "740_plus": 740,
    }.get(str(answers.get("credit_range", "")), 0)


def _loan_amount(answers: dict[str, str]) -> float:
    try:
        return float(answers.get("loan_amount", 0))
    except (TypeError, ValueError):
        return 0.0


Rule = Callable[[dict[str, str]], bool]

DISQUALIFYING_RULES: dict[str, list[Rule]] = {
    "dscr": [
        lambda a: a.get("property_type") == "primary",
        lambda a: _credit_min(a) < 620,
    ],
    "bank_statement": [
        lambda a: a.get("income_type") != "self_employed",
    ],
    "asset_depletion": [
        lambda a: a.get("income_type") not in ("assets", "retired"),
    ],
    "full_doc": [
        lambda a: a.get("income_type") != "w2",
    ],
    "foreign_national": [
        lambda a: a.get("income_type") != "foreign_national",
    ],
    "interest_only": [
        lambda a: _credit_min(a) < 660,
        lambda a: _loan_amount(a) < 500_000,
    ],
}

SCORING_SIGNALS: dict[str, list[tuple[Rule, int]]] = {
    "dscr": [
        (lambda a: a.get("property_type") == "investment", 30),
        (lambda a: a.get("income_type") == "rental", 25),
        (lambda a: _credit_min(a) >= 700, 20),
        (lambda a: _loan_amount(a) >= 300_000, 10),
    ],
    "bank_statement": [
        (lambda a: a.get("income_type") == "self_employed", 35),
        (lambda a: a.get("income_context.bank_statement_months") == "24", 15),
        (lambda a: _credit_min(a) >= 660, 15),
    ],
    "asset_depletion": [
        (lambda a: a.get("income_type") in ("assets", "retired"), 40),
        (lambda a: _credit_min(a) >= 680, 15),
    ],
    "full_doc": [
        (lambda a: a.get("income_type") == "w2", 35),
        (lambda a: a.get("income_context") == "consistent_employment_yes", 20),
        (lambda a: _credit_min(a) >= 660, 15),
    ],
    "foreign_national": [
        (lambda a: a.get("income_type") == "foreign_national", 45),
        (lambda a: a.get("income_context.has_us_itin") == "yes", 10),
        (lambda a: a.get("property_type") == "investment", 10),
    ],
    "interest_only": [
        (lambda a: _loan_amount(a) >= 750_000, 20),
        (lambda a: _credit_min(a) >= 700, 20),
        (lambda a: a.get("timeline") in ("now", "1_3_months"), 10),
    ],
}


def rank_programs(answers: dict[str, str]) -> list[ProgramRecommendationOut]:
    scored: list[tuple[str, int, bool]] = []

    for program_key in PROGRAMS:
        disqualified = any(rule(answers) for rule in DISQUALIFYING_RULES.get(program_key, []))
        score = 0 if disqualified else sum(
            points
            for condition, points in SCORING_SIGNALS.get(program_key, [])
            if condition(answers)
        )
        scored.append((program_key, score, disqualified))

    scored.sort(key=lambda item: (-item[1], item[0]))
    qualified = [item for item in scored if not item[2]][:3]
    near_miss = [item for item in scored if item[2]][:1]

    results: list[ProgramRecommendationOut] = []
    for rank, (program_key, score, _) in enumerate(qualified, 1):
        results.append(
            ProgramRecommendationOut(
                program_key=program_key,
                rank=rank,
                match_strength="strong" if score >= 50 else "possible",
                disqualified=False,
                **PROGRAM_DEFINITIONS[program_key],
            )
        )

    for program_key, _, _ in near_miss:
        results.append(
            ProgramRecommendationOut(
                program_key=program_key,
                rank=len(results) + 1,
                match_strength="unlikely",
                disqualified=True,
                **PROGRAM_DEFINITIONS[program_key],
            )
        )

    return results
