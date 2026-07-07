# tests/backend/test_loan_financials_endpoint.py
"""Loan financials and terms endpoint tests. See ROADMAP.md §B."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_get_financials_returns_correct_shape(client, db, seed_minimum):
    token = seed_minimum["token"]

    # Create loan + financials
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    await client.put(
        f"/api/v1/loans/{loan_id}/financials",
        json={"loan_amount": 600000, "fico_score": 740, "ltv": 0.70, "dscr": 1.45},
        headers=_auth(token),
    )

    # Fetch financials
    resp = await client.get(f"/api/v1/loans/{loan_id}/financials", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["loan_amount"]) == 600000.0
    assert body["fico_score"] == 740
    assert "loan_id" in body
    assert "updated_at" in body


@pytest.mark.integration
async def test_get_financials_404_when_none_created(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    resp = await client.get(f"/api/v1/loans/{loan_id}/financials", headers=_auth(token))
    assert resp.status_code == 404


@pytest.mark.integration
async def test_get_terms_returns_correct_shape(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "bank_statement"},
        headers=_auth(token),
    )
    loan_id = loan_resp.json()["id"]
    await client.put(
        f"/api/v1/loans/{loan_id}/terms",
        json={"interest_rate": 7.25, "term_months": 360, "rate_type": "fixed"},
        headers=_auth(token),
    )
    resp = await client.get(f"/api/v1/loans/{loan_id}/terms", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["interest_rate"]) == 7.25
    assert body["term_months"] == 360
    assert body["rate_type"] == "fixed"


@pytest.mark.integration
async def test_financials_scoped_to_tenant(client, db, seed_minimum):
    """A loan from tenant A cannot have its financials read by a different user
    in a different tenant. 404 is returned, not 403, to avoid leaking existence."""
    # This requires a second-tenant token. Skip until multi-tenant seed is available.
    pytest.skip("Requires multi-tenant seed fixture")