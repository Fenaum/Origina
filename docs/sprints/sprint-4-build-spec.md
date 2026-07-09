# Sprint 4 — Implementation Spec
## Manager Layer: Team Visibility, Filters, and Notifications

> **For:** MiniMax M3 (or any LLM/developer implementing this sprint)
> **Validated by:** Claude Code after completion
> **Sprint goal:** A manager can see team health without opening individual loan files. Analytics is date-filtered and live. Loan officers get emailed when a loan is submitted.
> **Prerequisite:** Sprints 1–3 must be complete and all their tests green.

---

## Repo Context

```
src/backend/app/
  api/v1/
    loans.py         ← Pipeline endpoint has skip/limit from Sprint 1; needs assignment fields
    analytics.py     ← Fully built: summary, drilldown, export, saved views
    workflow.py      ← Notes, tasks, exceptions (complete)
  services/
    analytics_repo.py ← All analytics query logic lives here

src/frontend/src/
  components/
    analytics/
      AnalyticsFilterBar.tsx  ← Filter UI fully built (date range, status, program, purpose)
      (other analytics components)
    dashboard/                ← Role-specific dashboard cards
  hooks/
    useAnalytics.ts           ← Check if this exists; may still be fetching mock data
  types/
    analytics.ts              ← Analytics types (DatePreset, DateRangeField, AnalyticsFilter, etc.)
```

**Key insight for Phase 4.2:** The analytics backend is comprehensive (date presets, drilldown, saved views). The frontend `AnalyticsFilterBar` is also complete. The gap is that the frontend analytics hook likely calls the analytics endpoint with mock data or doesn't pass the filter state to the backend correctly.

---

## Phase 4.1 — Pipeline Assignments

**Goal:** Each loan in the pipeline table shows who owns it (account exec / processor / underwriter). The pipeline can be filtered by assignee.

### Current state of the pipeline SQL

The pipeline endpoint in `src/backend/app/api/v1/loans.py` has `_PIPELINE_SQL` which already fetches loan data with a LATERAL JOIN. After Sprint 1, it returns a paginated envelope.

Read the current `_PIPELINE_SQL` to see exactly which columns it selects. It likely already JOINs `users` for the borrower name but probably does NOT include the assigned user's name.

### Add assignment field to `LoanPipelineSummaryOut`

In `src/backend/app/schemas/loan_schema.py`, find `LoanPipelineSummaryOut`. Add:

```python
class LoanPipelineSummaryOut(BaseModel):
    # ... existing fields ...
    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = None    # ← add this
```

### Update `_PIPELINE_SQL` to include assignee name

In the existing SQL, add a LEFT JOIN to get the assigned user's name. Find the loans table alias (`l`) and add after the existing JOINs:

```sql
LEFT JOIN users assigned_user ON assigned_user.id = l.assigned_to
    AND assigned_user.tenant_id = l.tenant_id
```

Then in the SELECT list, add:
```sql
, l.assigned_to
, assigned_user.full_name AS assigned_to_name
```

### Add `assigned_to` filter to the pipeline endpoint

In the endpoint signature, add:
```python
def get_pipeline(
    skip: int = 0,
    limit: int = 50,
    assigned_to: UUID | None = None,    # ← add
    status: str | None = None,          # ← add
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Update the WHERE clause of `_PIPELINE_SQL` to be parameterized:
```sql
WHERE l.tenant_id = :tenant_id
  AND l.status NOT IN ('archived', 'cancelled')
  AND (:assigned_to IS NULL OR l.assigned_to = :assigned_to)
  AND (:status IS NULL OR l.status = :status)
```

Pass the new params to `db.execute`:
```python
{
    "tenant_id": current_user.tenant_id,
    "limit": limit,
    "skip": skip,
    "assigned_to": str(assigned_to) if assigned_to else None,
    "status": status,
}
```

Also update `_PIPELINE_COUNT_SQL` with the same WHERE additions.

### Update `src/frontend/src/types/api.ts`

Add `assigned_to` and `assigned_to_name` to `LoanPipelineSummaryOut`:
```typescript
export type LoanPipelineSummaryOut = {
  // ... existing fields ...
  assigned_to: string | null;
  assigned_to_name: string | null;
};
```

### Update `toSummary` in `loanService.ts`

Find the `toSummary` function that converts `LoanPipelineSummaryOut` → `LoanSummary`. Add:
```typescript
owner: row.assigned_to_name ?? "—",
```

### Add "Assign To" column to `PipelineGrid.tsx`

In the pipeline table, find the column headers. Add an "Owner" column that shows `loan.owner`. When the cell is blank ("—"), style it with a muted class.

Optionally, add a filter dropdown above the table that lets the user filter by `assigned_to`. This dropdown should fetch `GET /api/v1/users/` to populate the options list, and pass the selected user ID to the `useLoans` hook.

### Write `tests/backend/test_pipeline_filters.py`

```python
# tests/backend/test_pipeline_filters.py
"""Pipeline assignment and filter tests."""
import pytest
from sqlalchemy import text


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_pipeline_includes_assigned_to_name(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    # Assign the loan to the seed user
    db.execute(
        text("UPDATE loans SET assigned_to = :uid WHERE id = :lid"),
        {"uid": seed_minimum["user_id"], "lid": loan_id},
    )
    db.commit()

    pipeline_r = await client.get("/api/v1/loans/pipeline?skip=0&limit=100", headers=_auth(token))
    assert pipeline_r.status_code == 200
    items = pipeline_r.json()["items"]
    target = next((i for i in items if i["id"] == loan_id), None)
    assert target is not None
    assert target["assigned_to"] == seed_minimum["user_id"]
    assert target["assigned_to_name"] == "Test Admin"


@pytest.mark.integration
async def test_pipeline_filter_by_status(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    # Transition to submitted
    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    r = await client.get("/api/v1/loans/pipeline?status=submitted", headers=_auth(token))
    items = r.json()["items"]
    assert all(i["status"] == "submitted" for i in items)
    assert any(i["id"] == loan_id for i in items)
```

**Phase 4.1 done when:** Pipeline shows "Owner" column with the assigned user's name. Filtering by `?assigned_to={uuid}` returns only that person's loans. Both new tests pass.

---

## Phase 4.2 — Analytics Wired to Backend

**Goal:** The analytics dashboard calls the real backend. Date range and status filters actually change what data is shown.

### Audit the analytics hook

Find `src/frontend/src/hooks/useAnalytics.ts` (or equivalent). Determine if it:
- Uses `useQuery` from React Query
- Calls `GET /api/v1/analytics/summary` with the filter state as query params
- Or is still returning mock data

If it returns mock data, wire it to the backend.

### Verify the analytics API shape

The backend accepts filter params either as:
- GET query params for `/summary` (flat structure)
- POST body for `/drilldown` (structured `AnalyticsFilterRequest`)

Read the `GET /analytics/summary` endpoint signature in `analytics.py` to understand what query params it accepts. The frontend filter state in `AnalyticsFilter` (from `types/analytics.ts`) must be mapped to these params.

### Create `src/frontend/src/services/analyticsService.ts`

```typescript
import { apiRequest } from "@/services/apiClient";
import type { AnalyticsFilter } from "@/types/analytics";

// These types mirror the backend AnalyticsSchema — add to types/api.ts after reading the schema
export type SummaryResponse = {
  total_loans: number;
  total_volume: number;
  by_status: Record<string, number>;
  by_program: Record<string, number>;
  by_purpose: Record<string, number>;
  avg_loan_amount: number;
  // add fields as they appear in the backend response
};

export async function fetchAnalyticsSummary(
  filter: AnalyticsFilter,
  token: string,
): Promise<SummaryResponse> {
  const params = new URLSearchParams();

  // Date range
  if (filter.dateRange) {
    params.set("date_field", filter.dateRange.field);
    if (filter.dateRange.preset) params.set("date_preset", filter.dateRange.preset);
    if (filter.dateRange.from_date) params.set("date_from", filter.dateRange.from_date);
    if (filter.dateRange.to_date) params.set("date_to", filter.dateRange.to_date);
  }

  // Field filters
  for (const f of filter.filters) {
    if (f.field === "status" && Array.isArray(f.value)) {
      for (const v of f.value as string[]) params.append("statuses", v);
    }
    if (f.field === "loan_program" && Array.isArray(f.value)) {
      for (const v of f.value as string[]) params.append("loan_programs", v);
    }
    if (f.field === "purpose" && Array.isArray(f.value)) {
      for (const v of f.value as string[]) params.append("purposes", v);
    }
  }

  params.set("page", String(filter.page ?? 1));
  params.set("limit", "50");

  return apiRequest<SummaryResponse>(`/analytics/summary?${params.toString()}`, { token });
}
```

### Wire the analytics hook

Find or create `src/frontend/src/hooks/useAnalytics.ts`. Replace mock data fetch with:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/state/auth";
import { fetchAnalyticsSummary } from "@/services/analyticsService";
import type { AnalyticsFilter } from "@/types/analytics";

export function useAnalytics(filter: AnalyticsFilter) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["analytics", "summary", filter],
    queryFn: () => fetchAnalyticsSummary(filter, token!),
    enabled: !!token,
    staleTime: 60_000,
  });
}
```

The analytics page should pass `filter` state from `AnalyticsFilterBar` into this hook. When the filter changes (the user picks a different date range or status), the `queryKey` changes and React Query refetches automatically.

### Wire the analytics page

Find `src/frontend/src/pages/analytics/index.tsx` (or similar). It should:
1. Hold `filter` state (initialized with a default `AnalyticsFilter`)
2. Render `<AnalyticsFilterBar filter={filter} onChange={setFilter} />`
3. Pass `filter` to `useAnalytics(filter)` → get `{ data, isLoading, isError }`
4. Pass `data` down to the chart components

If the charts currently accept mock data, they will need to accept the live response shape instead. Update the chart components to consume `SummaryResponse` fields.

### Write `tests/backend/test_analytics_summary.py`

```python
# tests/backend/test_analytics_summary.py
"""Analytics summary endpoint tests."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_summary_returns_expected_shape(client, db, seed_minimum):
    token = seed_minimum["token"]
    r = await client.get("/api/v1/analytics/summary", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    # Verify the response has the expected top-level keys
    # (adjust these based on the actual response shape from analytics_repo)
    assert "total_loans" in body or "summary" in body  # accept either shape


@pytest.mark.integration
async def test_summary_with_date_preset(client, db, seed_minimum):
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary?date_field=submitted_at&date_preset=last_30_days",
        headers=_auth(token),
    )
    assert r.status_code == 200


@pytest.mark.integration
async def test_summary_with_status_filter(client, db, seed_minimum):
    token = seed_minimum["token"]
    r = await client.get(
        "/api/v1/analytics/summary?statuses=submitted&statuses=approved",
        headers=_auth(token),
    )
    assert r.status_code == 200
```

**Phase 4.2 done when:** Changing the date range in the analytics dashboard triggers a new API call and the charts update. The filter bar is not cosmetic — it controls what data is shown.

---

## Phase 4.3 — Manager Dashboard

**Goal:** A user with the `account_manager` role sees a dashboard with team KPIs — not just their own data.

### What to build

The manager dashboard is a role-specific page at `/dashboard/manager` (or whatever path `roleDashboardPaths["account_manager"]` resolves to in `types/auth.ts`).

Read `src/frontend/src/pages/dashboard/` to see what dashboard pages exist. Find the account manager dashboard and see its current state (likely placeholder cards).

### Manager KPI cards to build

Each card fetches from the analytics or pipeline API:

| Card | Backend call | Display |
|---|---|---|
| Total Active Loans | `GET /analytics/summary?statuses=submitted,conditions_review,approved_pending,approved` | Count + total volume |
| Avg Processing Days | Analytics endpoint | Average days from `submitted_at` to `conditions_review` transition |
| Loans by Program | Analytics summary | Bar chart: DSCR, Bank Statement, Asset Depletion, etc. |
| My Team's Pipeline | `GET /loans/pipeline?assigned_to={each_team_member}` | Table of team members with their loan counts |

The "My Team's Pipeline" card requires:
1. Fetch `GET /users/` to get team members
2. For each team member, count their active loans (this can be a single analytics drilldown call with `group_by=assigned_to`)

### Simplified approach for Phase 4.3

Rather than fetching per-user pipeline data (N+1 pattern), use the analytics drilldown:

```typescript
// POST /api/v1/analytics/drilldown
// body: { filters: [], group_by: "assigned_to", date_range: { field: "submitted_at", preset: "year_to_date" } }
```

This returns aggregated counts per assigned user. Combine with `GET /users/` to resolve UUIDs → names.

### Create the KPI cards

Create `src/frontend/src/components/dashboard/manager/` directory with:
- `TeamKPICard.tsx` — active loans count + volume
- `LoansByProgramChart.tsx` — recharts bar chart driven by live analytics
- `TeamPipelineTable.tsx` — one row per team member, with their loan count

### Write `tests/frontend/ManagerDashboard.test.tsx`

```tsx
// tests/frontend/ManagerDashboard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    data: {
      total_loans: 42,
      total_volume: 18000000,
      by_status: { submitted: 12, conditions_review: 8, approved: 5 },
      by_program: { dscr: 20, bank_statement: 15, asset_depletion: 7 },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/state/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "account_manager" },
    token: "mock-token",
    effectiveRole: "account_manager",
  }),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/dashboard/manager", push: vi.fn() }),
}));

// Import the actual manager dashboard page or its primary component
// Adjust the import path based on what the manager dashboard page exports
// import ManagerDashboard from "@/pages/dashboard/manager";

describe("Manager Dashboard", () => {
  it("renders KPI section without crashing", () => {
    // render(<ManagerDashboard />);
    // expect(screen.getByText(/Active Loans/i)).toBeInTheDocument();
    // Placeholder — complete once the component path is known
    expect(true).toBe(true);
  });
});
```

**Phase 4.3 done when:** Account manager role shows team KPI cards with live data. The "42 active loans" number changes when date filter changes. `./scripts/run_tests.sh` passes.

---

## Phase 4.4 — Domain Events + Notifications

**Goal:** A `domain_events` table (transactional outbox) records key loan events; a dispatcher fans them out to consumers. The first consumer is email: a loan officer receives an email when their loan is submitted, underwriters when a loan enters `conditions_review`.

> **Why events, not inline SMTP:** See the "Domain Events via Transactional Outbox" ADR in `docs/DECISIONS.md`. Notifications are the *first* consumer of loan events — webhooks, AI triggers, and SLA timers come later and must not require re-touching the loan routes. Events are written in the same DB transaction as the state change, so an event exists if and only if the change committed.

### 1. Migration: `db/migrations/<next_number>_domain_events.sql`

Check `db/migrations/` for the next available number (Settings module may have claimed 126–131 — use the next free one).

```sql
-- Domain events: transactional outbox for cross-cutting consumers
-- (notifications now; webhooks, AI triggers, SLA timers later).
-- Append-only. Written in the same transaction as the state change they describe.

CREATE TABLE domain_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    event_type    TEXT NOT NULL CHECK (event_type IN (
        'loan.submitted',
        'loan.status_changed',
        'condition.cleared',
        'condition.rejected',
        'document.uploaded'
    )),
    entity_type   TEXT NOT NULL,
    entity_id     UUID NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at  TIMESTAMPTZ
);

-- Dispatcher polls for unprocessed events
CREATE INDEX idx_domain_events_unprocessed
    ON domain_events (occurred_at)
    WHERE processed_at IS NULL;

CREATE INDEX idx_domain_events_entity
    ON domain_events (tenant_id, entity_type, entity_id);
```

Adding a new `event_type` later = widen the CHECK constraint in a new migration (same pattern as every other TEXT+CHECK column).

### 2. Model: `src/backend/app/models/events.py`

```python
"""Domain events — transactional outbox. See DECISIONS.md ADR."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AppendOnlyModel


class EventType:
    LOAN_SUBMITTED      = "loan.submitted"
    LOAN_STATUS_CHANGED = "loan.status_changed"
    CONDITION_CLEARED   = "condition.cleared"
    CONDITION_REJECTED  = "condition.rejected"
    DOCUMENT_UPLOADED   = "document.uploaded"

    ALL: frozenset[str] = frozenset({
        "loan.submitted", "loan.status_changed",
        "condition.cleared", "condition.rejected", "document.uploaded",
    })


class DomainEvent(AppendOnlyModel):
    __tablename__ = "domain_events"

    event_type:   Mapped[str] = mapped_column(String, nullable=False)
    entity_type:  Mapped[str] = mapped_column(String, nullable=False)
    entity_id:    Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    payload:      Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

(Adjust field/mixin details to match how `AppendOnlyModel` is actually defined in `models/base.py` — read it first. If `AppendOnlyModel` already provides `created_at`, you may use that instead of a separate `occurred_at`.)

### 3. Emitter: `src/backend/app/services/event_service.py`

```python
"""
Domain event emitter + dispatcher.

emit_event() writes an event row using the CALLER's session — same transaction
as the state change. Do not commit inside emit_event; the caller owns the
transaction boundary.

dispatch_pending_events() is the fan-out: reads unprocessed events, routes each
to its consumers (email today), marks processed. Runs after request commit via
FastAPI BackgroundTasks, and once at startup to pick up anything missed.
Consumers must be idempotent — delivery is at-least-once.
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.events import DomainEvent, EventType


def emit_event(
    db: Session,
    *,
    tenant_id: UUID,
    event_type: str,
    entity_type: str,
    entity_id: UUID,
    payload: dict | None = None,
) -> DomainEvent:
    event = DomainEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    return event   # caller commits


def dispatch_pending_events(db: Session, limit: int = 100) -> int:
    """Process unprocessed events. Returns count handled. Never raises."""
    from app.services import notification_consumer

    events = (
        db.query(DomainEvent)
        .filter(DomainEvent.processed_at.is_(None))
        .order_by(DomainEvent.occurred_at)
        .limit(limit)
        .all()
    )
    handled = 0
    for event in events:
        try:
            notification_consumer.handle(db, event)
        except Exception:
            # A failing consumer must not block the queue or other events.
            # Log and continue; the event stays processed (email is best-effort).
            import logging
            logging.getLogger("origina_backend").exception(
                "Event consumer failed for %s %s", event.event_type, event.id
            )
        event.processed_at = datetime.now(timezone.utc)
        handled += 1
    db.commit()
    return handled
```

### 4. Wire event emission into `status.py`

In `transition_status()`, **before** `db.commit()` (same transaction as the status change and the `LoanStatusEvent`):

```python
from app.services.event_service import emit_event
from app.models.events import EventType

    # after building the LoanStatusEvent, before db.commit():
    emit_event(
        db,
        tenant_id=current_user.tenant_id,
        event_type=EventType.LOAN_SUBMITTED if target == "submitted" else EventType.LOAN_STATUS_CHANGED,
        entity_type="loan",
        entity_id=loan_id,
        payload={
            "from_status": current,
            "to_status": target,
            "actor_user_id": str(current_user.id),
            "assigned_to": str(loan.assigned_to) if loan.assigned_to else None,
        },
    )
    db.add(event)
    db.commit()
```

Then **after** the commit, kick the dispatcher without blocking the response. Add `background_tasks: BackgroundTasks` to the endpoint signature:

```python
from fastapi import BackgroundTasks
from app.core.db import SessionLocal
from app.services.event_service import dispatch_pending_events

def _dispatch_in_background():
    db = SessionLocal()
    try:
        dispatch_pending_events(db)
    finally:
        db.close()

    # last line of transition_status, after db.commit()/db.refresh():
    background_tasks.add_task(_dispatch_in_background)
    return event
```

Also call `dispatch_pending_events` once in the `on_startup` handler in `core/main.py` so events left unprocessed by a crash are picked up on boot (wrap in try/except — startup must not fail if the DB is briefly unavailable).

Do the same `emit_event` wiring in `submit_loan` (`loans.py`) with `EventType.LOAN_SUBMITTED`, and in `clear_condition`/`reject_condition` (`conditions.py`) with the condition event types.

### 5. Consumer: `src/backend/app/services/notification_consumer.py`

Routes events to email. This is the ONLY place that knows notifications exist — the loan routes know nothing about email.

```python
"""First domain-event consumer: email notifications.

handle(db, event) is called by the dispatcher for every event. It decides
whether this event type produces an email, resolves recipients, and sends.
Must be idempotent per event (at-least-once delivery).
"""
from sqlalchemy.orm import Session

from app.models.events import DomainEvent, EventType
from app.models.user import Role, User, UserRole
from app.services.notification_service import send_email


def handle(db: Session, event: DomainEvent) -> None:
    if event.event_type == EventType.LOAN_SUBMITTED:
        _on_loan_submitted(db, event)
    elif event.event_type == EventType.LOAN_STATUS_CHANGED:
        if event.payload.get("to_status") == "conditions_review":
            _on_conditions_review(db, event)
    # other event types: no notification (yet)


def _loan_link(loan_id: str) -> str:
    return f"http://localhost:3000/loans/{loan_id}"


def _on_loan_submitted(db: Session, event: DomainEvent) -> None:
    assigned_to = event.payload.get("assigned_to")
    if not assigned_to:
        return
    assignee = db.get(User, assigned_to)
    if not assignee or not assignee.is_active:
        return
    send_email(
        to=assignee.email,
        subject=f"[Origina] Loan Submitted — {event.entity_id}",
        body=(
            "A loan has been submitted and is ready for review.\n\n"
            f"Loan ID: {event.entity_id}\n\n"
            f"Review it here: {_loan_link(str(event.entity_id))}\n"
        ),
    )


def _on_conditions_review(db: Session, event: DomainEvent) -> None:
    uw_role = (
        db.query(Role)
        .filter(Role.tenant_id == event.tenant_id, Role.name == "underwriter")
        .first()
    )
    if not uw_role:
        return
    underwriters = (
        db.query(User)
        .join(UserRole, UserRole.user_id == User.id)
        .filter(
            UserRole.role_id == uw_role.id,
            UserRole.tenant_id == event.tenant_id,
            User.is_active.is_(True),
        )
        .all()
    )
    for uw in underwriters:
        send_email(
            to=uw.email,
            subject=f"[Origina] Conditions Review — {event.entity_id}",
            body=(
                "A loan has entered Conditions Review and requires underwriter attention.\n\n"
                f"Loan ID: {event.entity_id}\n\n"
                f"Review conditions here: {_loan_link(str(event.entity_id))}\n"
            ),
        )
```

### 6. Create `src/backend/app/services/notification_service.py`

The low-level email sender — knows SMTP, knows nothing about loans or events.

```python
"""
Minimal email sender. Consumers (notification_consumer.py) build the message;
this module only delivers it.

Configuration (add to config.py):
  SMTP_HOST     = os.getenv("SMTP_HOST", "")
  SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
  SMTP_USER     = os.getenv("SMTP_USER", "")
  SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
  SMTP_FROM     = os.getenv("SMTP_FROM", "noreply@origina.dev")
  NOTIFICATIONS_ENABLED = SMTP_HOST != ""
"""

import logging
import smtplib
from email.mime.text import MIMEText
from typing import Optional

from app.core import config

log = logging.getLogger("origina_backend")


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if sent, False if skipped or failed."""
    if not getattr(config, "NOTIFICATIONS_ENABLED", False):
        log.debug("Notifications disabled (SMTP_HOST not set) — skipping email to %s", to)
        return False
    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM
        msg["To"] = to
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            smtp.send_message(msg)
        log.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        log.warning("Failed to send email to %s: %s", to, exc)
        return False
```

### 7. Add SMTP config to `src/backend/app/core/config.py`

```python
SMTP_HOST     = os.getenv("SMTP_HOST", "")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM     = os.getenv("SMTP_FROM", "noreply@origina.dev")
NOTIFICATIONS_ENABLED = bool(SMTP_HOST)
```

Also add these to `.env.example`:
```bash
# ── Email notifications (optional) ───────────────────────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@origina.dev
```

### 8. Write `tests/backend/test_domain_events.py`

```python
# tests/backend/test_domain_events.py
"""Domain events (transactional outbox) + notification consumer tests."""
import pytest
from unittest.mock import patch
from sqlalchemy import text


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_status_transition_emits_event(client, db, seed_minimum):
    """Transitioning a loan writes a domain_events row in the same transaction."""
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )
    assert r.status_code == 201

    row = db.execute(
        text(
            "SELECT event_type, payload FROM domain_events "
            "WHERE entity_id = :id AND event_type = 'loan.submitted'"
        ),
        {"id": loan_id},
    ).fetchone()
    assert row is not None, "loan.submitted event was not emitted"


@pytest.mark.integration
async def test_dispatcher_marks_events_processed(client, db, seed_minimum):
    """dispatch_pending_events processes unprocessed events and stamps processed_at."""
    from app.services.event_service import dispatch_pending_events

    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]
    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    handled = dispatch_pending_events(db)
    assert handled >= 1

    unprocessed = db.execute(
        text("SELECT COUNT(*) FROM domain_events WHERE entity_id = :id AND processed_at IS NULL"),
        {"id": loan_id},
    ).scalar_one()
    assert unprocessed == 0


def test_send_email_skipped_when_smtp_not_configured():
    """With SMTP_HOST unset, send_email returns False and does not open a connection."""
    from app.services import notification_service

    with patch.object(notification_service.config, "NOTIFICATIONS_ENABLED", False):
        result = notification_service.send_email("test@test.com", "Subject", "Body")
    assert result is False


@pytest.mark.integration
async def test_transition_succeeds_when_consumer_fails(client, db, seed_minimum):
    """Status transition succeeds even if the notification consumer raises."""
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    with patch(
        "app.services.notification_consumer.handle",
        side_effect=RuntimeError("consumer exploded"),
    ):
        r = await client.post(
            f"/api/v1/loans/{loan_id}/status/transition",
            json={"to_status": "submitted"},
            headers=_auth(token),
        )
    assert r.status_code == 201  # transition succeeded despite consumer failure


@pytest.mark.integration
async def test_dispatcher_survives_consumer_failure(client, db, seed_minimum):
    """A failing consumer does not block the queue — the event is still marked processed."""
    from app.services.event_service import dispatch_pending_events

    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]
    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    with patch(
        "app.services.notification_consumer.handle",
        side_effect=RuntimeError("consumer exploded"),
    ):
        handled = dispatch_pending_events(db)
    assert handled >= 1  # dispatcher did not raise, queue drained
```

**Phase 4.4 done when:** A status transition to `submitted` writes a `loan.submitted` event in the same transaction; the dispatcher processes it and (when SMTP is configured) sends the email. SMTP is disabled by default so tests pass without a mail server. Consumer failures never abort a transition or block the queue. All 5 new tests pass.

---

## Sprint 4 B-gate checklist

- [ ] Sprint 1–3 tests still green
- [ ] `tests/backend/test_pipeline_filters.py` (2 new tests)
- [ ] `tests/backend/test_analytics_summary.py` (3 new tests)
- [ ] `tests/backend/test_domain_events.py` (5 new tests)
- [ ] `tests/frontend/ManagerDashboard.test.tsx` (1 new test)
- [ ] `domain_events` migration applied; migration sequence updated in `docs/architecture/database.md`
- [ ] Manual: pipeline shows "Owner" column with real names
- [ ] Manual: analytics date range filter changes the chart data
- [ ] Manual: account manager dashboard shows team KPI cards
- [ ] Manual: transition a loan to `submitted` → `SELECT * FROM domain_events` shows the event, marked processed; no error even without SMTP configured
