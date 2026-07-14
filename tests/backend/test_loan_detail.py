"""
Sprint 6 §6.2 — `GET /loans/{id}/detail` returns the loan + financials +
terms + primary borrower + co-borrowers + subject property + other
properties in one fetch. The frontend workspace used to issue 4 parallel
calls (or worse, scan the pipeline with `limit=1000`) to render one tab.

This test exercises the new endpoint end-to-end:
  - happy path with all satellite data populated
  - 404 when the loan doesn't belong to the requester's tenant
  - empty co-borrowers / other_properties when none are seeded
"""
import uuid

import pytest
from sqlalchemy import text

from app.models.borrowers import Borrower
from app.models.loan import Loan, LoanFinancials, LoanTerms
from app.models.properties import Property


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def loan_with_satellites(db, seed_minimum):
    """Seed a loan + financials + terms + 2 borrowers + 2 properties
    so the detail endpoint has something to assemble."""
    token = seed_minimum["token"]
    tenant_id = seed_minimum["tenant_id"]
    user_id = seed_minimum["user_id"]

    loan_id = uuid.uuid4()
    db.execute(
        text("""
            INSERT INTO loans (
                id, tenant_id, loan_number, status, purpose,
                loan_program, occupancy_type
            ) VALUES (
                :id, :tid, 'TEST-DETAIL-001', 'submitted', 'purchase',
                'dscr', 'investment'
            )
        """),
        {"id": loan_id, "tid": tenant_id},
    )

    db.execute(
        text("""
            INSERT INTO loan_financials (
                loan_id, tenant_id, loan_amount, ltv, fico_score, dscr
            ) VALUES (
                :id, :tid, 450000, 75.00, 720, 1.25
            )
        """),
        {"id": loan_id, "tid": tenant_id},
    )

    db.execute(
        text("""
            INSERT INTO loan_terms (
                loan_id, tenant_id, interest_rate, term_months, rate_type
            ) VALUES (
                :id, :tid, 7.50, 360, 'fixed'
            )
        """),
        {"id": loan_id, "tid": tenant_id},
    )

    db.execute(
        text("""
            INSERT INTO borrowers (
                id, tenant_id, loan_id, type,
                first_name, last_name, email, phone,
                income_type, income_amount, employer_name
            ) VALUES (
                :id, :tid, :lid, 'primary_borrower',
                'Jane', 'Smith', 'jane@example.com', '555-0100',
                'salary', 12000, 'Acme Co'
            )
        """),
        {"id": uuid.uuid4(), "tid": tenant_id, "lid": loan_id},
    )
    db.execute(
        text("""
            INSERT INTO borrowers (
                id, tenant_id, loan_id, type,
                first_name, last_name, email, phone
            ) VALUES (
                :id, :tid, :lid, 'co_borrower',
                'John', 'Smith', 'john@example.com', '555-0101'
            )
        """),
        {"id": uuid.uuid4(), "tid": tenant_id, "lid": loan_id},
    )

    db.execute(
        text("""
            INSERT INTO properties (
                id, tenant_id, loan_id, is_subject,
                address1, city, state, postal_code, property_type, occupancy
            ) VALUES (
                :id, :tid, :lid, true,
                '123 Main St', 'Miami', 'FL', '33101', 'single_family', 'investment'
            )
        """),
        {"id": uuid.uuid4(), "tid": tenant_id, "lid": loan_id},
    )
    db.execute(
        text("""
            INSERT INTO properties (
                id, tenant_id, loan_id, is_subject,
                address1, city, state, postal_code, property_type, occupancy
            ) VALUES (
                :id, :tid, :lid, false,
                '456 Oak Ave', 'Tampa', 'FL', '33602', 'condo', 'second_home'
            )
        """),
        {"id": uuid.uuid4(), "tid": tenant_id, "lid": loan_id},
    )

    db.commit()
    return {
        "loan_id": str(loan_id),
        "tenant_id": tenant_id,
        "token": token,
    }


@pytest.mark.integration
async def test_loan_detail_returns_full_payload(client, loan_with_satellites):
    """Detail endpoint joins loan + financials + terms + borrowers + properties."""
    loan_id = loan_with_satellites["loan_id"]
    response = await client.get(
        f"/api/v1/loans/{loan_id}/detail",
        headers=_auth(loan_with_satellites["token"]),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    # Header
    assert body["id"] == str(loan_id)
    assert body["loan_number"] == "TEST-DETAIL-001"
    assert body["status"] == "submitted"
    assert body["purpose"] == "purchase"

    # Financials
    assert body["financials"] is not None
    assert float(body["financials"]["loan_amount"]) == 450000.00
    assert body["financials"]["fico_score"] == 720

    # Terms
    assert body["terms"] is not None
    assert float(body["terms"]["interest_rate"]) == 7.5
    assert body["terms"]["term_months"] == 360

    # Borrowers — primary split out, co-borrower in the list
    assert body["primary_borrower"] is not None
    assert body["primary_borrower"]["first_name"] == "Jane"
    assert body["primary_borrower"]["last_name"] == "Smith"
    assert body["primary_borrower"]["income_type"] == "salary"
    assert body["primary_borrower"]["employer_name"] == "Acme Co"

    assert len(body["co_borrowers"]) == 1
    assert body["co_borrowers"][0]["first_name"] == "John"

    # Properties — subject split out, others in the list
    assert body["subject_property"] is not None
    assert body["subject_property"]["address1"] == "123 Main St"
    assert body["subject_property"]["is_subject"] is True
    assert body["subject_property"]["city"] == "Miami"

    assert len(body["other_properties"]) == 1
    assert body["other_properties"][0]["address1"] == "456 Oak Ave"


@pytest.mark.integration
async def test_loan_detail_404_for_other_tenant(client, db, seed_minimum):
    """Cross-tenant access must 404, not 403, to avoid leaking loan
    existence to other tenants."""
    # Create a loan for the same tenant (so it exists)
    tenant_id = seed_minimum["tenant_id"]
    token = seed_minimum["token"]
    loan_id = uuid.uuid4()
    db.execute(
        text("INSERT INTO loans (id, tenant_id, status) VALUES (:id, :tid, 'new_draft')"),
        {"id": loan_id, "tid": tenant_id},
    )
    db.commit()

    # Spawn a second tenant + token + role/user
    other_tenant_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    db.execute(
        text("INSERT INTO tenants (id, name) VALUES (:id, :name)"),
        {"id": other_tenant_id, "name": f"Other {other_tenant_id.hex[:6]}"},
    )
    import bcrypt
    pw_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode()
    db.execute(
        text(
            "INSERT INTO users (id, tenant_id, email, password_hash, full_name, is_active) "
            "VALUES (:id, :tid, :em, :pw, :nm, true)"
        ),
        {
            "id": other_user_id, "tid": other_tenant_id,
            "em": "other-detail@test.dev", "pw": pw_hash, "nm": "Other Detail",
        },
    )
    db.commit()

    # Issue a token for the other tenant
    from app.security.jwt import create_access_token
    other_token = create_access_token(other_user_id, other_tenant_id)

    response = await client.get(
        f"/api/v1/loans/{loan_id}/detail",
        headers=_auth(other_token),
    )
    assert response.status_code == 404, response.text


@pytest.mark.integration
async def test_loan_detail_handles_empty_satellites(client, db, seed_minimum):
    """A fresh loan with no financials, terms, borrowers, or properties
    should return 200 with all the satellite fields as None / []. This
    is the realistic state on a brand-new draft."""
    token = seed_minimum["token"]
    tenant_id = seed_minimum["tenant_id"]
    loan_id = uuid.uuid4()
    db.execute(
        text(
            "INSERT INTO loans (id, tenant_id, loan_number, status, purpose) "
            "VALUES (:id, :tid, :num, 'new_draft', 'purchase')"
        ),
        {"id": loan_id, "tid": tenant_id, "num": "TEST-DETAIL-EMPTY"},
    )
    db.commit()

    response = await client.get(
        f"/api/v1/loans/{loan_id}/detail",
        headers=_auth(token),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == str(loan_id)
    assert body["financials"] is None
    assert body["terms"] is None
    assert body["primary_borrower"] is None
    assert body["co_borrowers"] == []
    assert body["subject_property"] is None
    assert body["other_properties"] == []
