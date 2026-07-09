# tests/backend/test_loan_submission_e2e.py
"""Loan submission end-to-end tests. See ROADMAP.md §B."""
import pytest
from sqlalchemy import text


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_submit_creates_all_three_rows(client, db, seed_minimum):
    """
    Full happy path:
    1. Create a loan draft (POST /loans/)
    2. PUT financials
    3. PUT terms
    4. POST submit
    5. Verify loans + loan_financials + loan_terms all exist in DB
    """
    token = seed_minimum["token"]

    # Step 1: create loan
    create_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth_headers(token),
    )
    assert create_resp.status_code == 201
    loan_id = create_resp.json()["id"]

    # Step 2: put financials
    fin_resp = await client.put(
        f"/api/v1/loans/{loan_id}/financials",
        json={"loan_amount": 450000, "fico_score": 720, "ltv": 0.75, "dscr": 1.35},
        headers=_auth_headers(token),
    )
    assert fin_resp.status_code == 200

    # Step 3: put terms
    terms_resp = await client.put(
        f"/api/v1/loans/{loan_id}/terms",
        json={"interest_rate": 7.5, "term_months": 360, "rate_type": "fixed"},
        headers=_auth_headers(token),
    )
    assert terms_resp.status_code == 200

    # Step 4: submit
    submit_resp = await client.post(
        f"/api/v1/loans/{loan_id}/submit",
        headers=_auth_headers(token),
    )
    assert submit_resp.status_code == 200
    body = submit_resp.json()
    assert body["status"] == "submitted"
    # FastAPI returns Decimal as a string ("450000.00"); compare as float.
    assert float(body["loan_amount"]) == 450000.0

    # Step 5: verify DB rows exist
    fin_row = db.execute(
        text("SELECT loan_amount FROM loan_financials WHERE loan_id = :id"),
        {"id": loan_id},
    ).fetchone()
    assert fin_row is not None
    assert float(fin_row.loan_amount) == 450000.0

    terms_row = db.execute(
        text("SELECT term_months FROM loan_terms WHERE loan_id = :id"),
        {"id": loan_id},
    ).fetchone()
    assert terms_row is not None
    assert terms_row.term_months == 360


@pytest.mark.integration
async def test_submit_rejects_non_draft_status(client, db, seed_minimum):
    """A loan that is already submitted cannot be submitted again — returns 422."""
    token = seed_minimum["token"]

    create_resp = await client.post(
        "/api/v1/loans/",
        json={"purpose": "refinance", "loan_program": "bank_statement"},
        headers=_auth_headers(token),
    )
    loan_id = create_resp.json()["id"]

    # Submit once — should succeed
    r1 = await client.post(f"/api/v1/loans/{loan_id}/submit", headers=_auth_headers(token))
    assert r1.status_code == 200

    # Submit again — should fail
    r2 = await client.post(f"/api/v1/loans/{loan_id}/submit", headers=_auth_headers(token))
    assert r2.status_code == 422


@pytest.mark.integration
async def test_tenant_isolation_on_loan(client, db, seed_two_tenants):
    """A loan created by tenant A is not visible in tenant B's pipeline."""
    tenant_a, tenant_b = seed_two_tenants

    # 1. Tenant A submits a loan
    r_a = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth_headers(tenant_a["token"]),
    )
    assert r_a.status_code == 201, r_a.text
    loan_id_a = r_a.json()["id"]

    # 2. Tenant A's pipeline sees the loan
    r_a_pipeline = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=10",
        headers=_auth_headers(tenant_a["token"]),
    )
    assert r_a_pipeline.status_code == 200
    assert any(item["id"] == loan_id_a for item in r_a_pipeline.json()["items"])

    # 3. Tenant B's pipeline does NOT see tenant A's loan
    r_b_pipeline = await client.get(
        "/api/v1/loans/pipeline?skip=0&limit=10",
        headers=_auth_headers(tenant_b["token"]),
    )
    assert r_b_pipeline.status_code == 200
    assert all(item["id"] != loan_id_a for item in r_b_pipeline.json()["items"])

