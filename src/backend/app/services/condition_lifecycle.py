"""Condition lifecycle state machine.

The condition model has five statuses (open → submitted → cleared / waived /
rejected). This service is the single source of truth for which transitions
are legal. Endpoints import `assert_transition_allowed` and raise 422 when a
client tries to make an illegal move.

Valid transitions:
  open       → submitted
  open       → waived   (underwriter can waive before any submission)
  submitted  → cleared
  submitted  → waived
  submitted  → rejected
  Any terminal status → (nothing)

Terminal statuses: cleared, waived, rejected
"""
from __future__ import annotations

from fastapi import HTTPException

from app.models.conditions import ConditionStatus


TRANSITIONS: dict[str, list[str]] = {
    ConditionStatus.OPEN:      [ConditionStatus.SUBMITTED, ConditionStatus.WAIVED],
    ConditionStatus.SUBMITTED: [ConditionStatus.CLEARED, ConditionStatus.WAIVED, ConditionStatus.REJECTED],
    ConditionStatus.CLEARED:   [],
    ConditionStatus.WAIVED:    [],
    ConditionStatus.REJECTED:  [],
}


def allowed_from(current: str) -> list[str]:
    """List of statuses reachable from `current`. Useful for UI affordances."""
    return list(TRANSITIONS.get(current, []))


def assert_transition_allowed(current: str, target: str) -> None:
    """Raise HTTPException(422) if `current → target` is not a permitted move.

    Why 422 (not 400 / 409): the request was syntactically valid and the
    resource exists — what failed is a precondition on the resource state.
    422 Unprocessable Entity is the closest match per RFC 4918.
    """
    allowed = TRANSITIONS.get(current, [])
    if target not in allowed:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Cannot transition condition from '{current}' to '{target}'. "
                f"Allowed from '{current}': {allowed or ['none — terminal status']}"
            ),
        )
