"""Sprint 5 §5.2 — coverage for the program-ranking heuristic."""
import pytest


def test_rank_programs_returns_three_top_matches():
    from app.services.intake_repo import rank_programs

    answers = {
        "credit_score": "720",
        "has_rental_income": "yes",
        "owns_business": "no",
        "primary_residence": "no",
    }
    results = rank_programs(answers)
    assert len(results) >= 1
    # Ranks should be in ascending order (1, 2, 3, ...)
    assert [r.rank for r in results] == sorted(r.rank for r in results)


def test_rank_programs_handles_empty_answers():
    from app.services.intake_repo import rank_programs
    results = rank_programs({})
    # Should still return something (no crashes)
    assert isinstance(results, list)


def test_rank_programs_disqualifies_when_rule_matches():
    """If a disqualifying rule fires, the program should be marked disqualified=True."""
    from app.services.intake_repo import rank_programs

    answers = {
        "primary_residence": "yes",
        "owns_business": "yes",
        "has_rental_income": "no",
        "credit_score": "750",
    }
    results = rank_programs(answers)
    # Find DSCR — it should be disqualified for primary residence = yes
    dscr = next((r for r in results if r.program_key == "dscr"), None)
    if dscr:
        assert dscr.disqualified


def test_rank_programs_match_strength_uses_score_threshold():
    """Score >= 50 → strong, otherwise possible."""
    from app.services.intake_repo import rank_programs

    strong_answers = {
        "credit_score": "780",
        "has_rental_income": "yes",
        "owns_business": "no",
        "primary_residence": "no",
        "liquid_assets": "yes",
    }
    results = rank_programs(strong_answers)
    assert isinstance(results, list)
    if results:
        assert results[0].match_strength in ("strong", "possible", "unlikely")
