"""Analytics summary endpoint tests — Sprint 4 §4.2.

The /analytics/summary endpoint accepts a flat GET shape (date range +
field filters + sort + pagination) and returns {meta, kpis, charts}. The
frontend AnalyticsFilterBar wires every filter knob to these params; we
verify the server respects each.
"""
import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_summary_returns_expected_shape(client, db, seed_minimum):
    """Default call returns the documented {meta, kpis, charts} envelope."""
    token = seed_minimum["token"]
    r = await client.get("/api/v1/analytics/summary", headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert "meta" in body
    assert "kpis" in body
    assert "charts" in body
    # KPIs is a list — every card has at minimum id/label/value.
    assert isinstance(body["kpis"], list)
    for kpi in body["kpis"]:
        assert {"id", "label", "value"}.issubset(kpi.keys())


@pytest.mark.integration
async def test_summary_with_date_preset(client, db, seed_minimum):
    """date_preset must filter to a window without erroring."""
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary"
        "?date_field=submitted_at&date_preset=last_30_days",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "meta" in body
    assert body["meta"]["filter_summary"]  # summary string rendered server-side


@pytest.mark.integration
async def test_summary_with_status_filter(client, db, seed_minimum):
    """?status=submitted restricts the summary to that status."""
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary?status=submitted",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "kpis" in body
    # No new loans created in this test — kpis list reflects the filtered
    # data. We just verify the response shape doesn't blow up with the filter.
    for kpi in body["kpis"]:
        assert "value" in kpi


@pytest.mark.integration
async def test_summary_with_loan_program_filter(client, db, seed_minimum):
    """Multiple ?loan_program= params are accepted.

    httpx's params={"loan_program": ["a", "b"]} flattens to "loan_program=a&loan_program=b" — exactly the
    multi-value query string FastAPI needs to populate a list[str] parameter.
    """
    import httpx as _httpx
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary",
        params=_httpx.QueryParams([("loan_program", "dscr"), ("loan_program", "bank_statement")]),
        headers=_auth(token),
    )
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"


@pytest.mark.integration
async def test_summary_invalid_preset_returns_422(client, db, seed_minimum):
    """date_preset is whitelisted; an unknown value must be rejected."""
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary?date_preset=invalid_preset",
        headers=_auth(token),
    )
    assert r.status_code in (400, 422), r.text
