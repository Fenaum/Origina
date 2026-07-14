from datetime import datetime, timezone
from os import getenv
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.intake import IntakeAnswer, IntakeHandoff, IntakeSession
from app.models.user import Tenant
from app.schemas.intake_schema import (
    AnswerSavedOut,
    HandoffOut,
    IntakeAnswerIn,
    IntakeHandoffIn,
    IntakeSessionOut,
    ProgramRecommendationOut,
)
from app.services.intake_repo import PROGRAM_DEFINITIONS, rank_programs

router = APIRouter(prefix="/intake", tags=["intake"])

ALLOWED_QUESTION_KEYS = {
    "purpose",
    "property_type",
    "income_type",
    "income_context",
    "income_context.bank_statement_months",
    "income_context.owns_rental_property",
    "income_context.monthly_rent",
    "income_context.asset_value_range",
    "income_context.has_us_itin",
    "credit_range",
    "loan_amount",
    "timeline",
}


def _platform_tenant_id(db: Session) -> UUID:
    configured = getenv("PLATFORM_TENANT_ID")
    if configured:
        try:
            return UUID(configured)
        except ValueError as exc:
            raise HTTPException(status_code=500, detail="Invalid PLATFORM_TENANT_ID") from exc

    # Bug fix (BUG-2026-07-11-001): `Query.scalar()` raises
    # MultipleResultsFound whenever the schema has 2+ tenants — common in
    # multi-tenant isolation tests. Switched to a LIMIT 1 SELECT so
    # anonymous intake picks the oldest tenant deterministically without
    # exploding when the schema already contains more than one.
    tenant_id = db.execute(
        select(Tenant.id).order_by(Tenant.created_at.asc()).limit(1)
    ).scalar_one_or_none()
    if tenant_id is None:
        raise HTTPException(status_code=500, detail="No tenant available for anonymous intake")
    return tenant_id


def _get_session_or_404(session_id: UUID, db: Session) -> IntakeSession:
    session = db.get(IntakeSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Intake session not found")
    return session


@router.post("/sessions", response_model=IntakeSessionOut, status_code=status.HTTP_201_CREATED)
def create_session(request: Request, db: Session = Depends(get_db)) -> IntakeSessionOut:
    session = IntakeSession(
        tenant_id=_platform_tenant_id(db),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/answers", response_model=AnswerSavedOut)
def save_answer(
    session_id: UUID,
    body: IntakeAnswerIn,
    db: Session = Depends(get_db),
) -> AnswerSavedOut:
    _get_session_or_404(session_id, db)
    if body.question_key not in ALLOWED_QUESTION_KEYS:
        raise HTTPException(status_code=422, detail="Unknown question key")

    existing = (
        db.query(IntakeAnswer)
        .filter(
            IntakeAnswer.session_id == session_id,
            IntakeAnswer.question_key == body.question_key,
        )
        .first()
    )
    if existing:
        existing.value = str(body.value)
        existing.answered_at = datetime.now(timezone.utc)
    else:
        db.add(
            IntakeAnswer(
                session_id=session_id,
                question_key=body.question_key,
                value=str(body.value),
            )
        )

    db.commit()
    return AnswerSavedOut(saved=True)


@router.get("/sessions/{session_id}/results", response_model=list[ProgramRecommendationOut])
def get_results(session_id: UUID, db: Session = Depends(get_db)) -> list[ProgramRecommendationOut]:
    session = _get_session_or_404(session_id, db)
    answers = db.query(IntakeAnswer).filter(IntakeAnswer.session_id == session_id).all()
    answer_map = {answer.question_key: answer.value for answer in answers}

    if not session.completed_at:
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

    return rank_programs(answer_map)


@router.post(
    "/sessions/{session_id}/handoff",
    response_model=HandoffOut,
    status_code=status.HTTP_201_CREATED,
)
def create_handoff(
    session_id: UUID,
    body: IntakeHandoffIn,
    db: Session = Depends(get_db),
) -> HandoffOut:
    _get_session_or_404(session_id, db)
    handoff = IntakeHandoff(
        session_id=session_id,
        name=body.name,
        email=str(body.email),
    )
    db.add(handoff)
    db.commit()
    db.refresh(handoff)
    return handoff


@router.get("/programs", response_model=list[ProgramRecommendationOut])
def list_programs() -> list[ProgramRecommendationOut]:
    return [
        ProgramRecommendationOut(
            program_key=key,
            rank=index,
            match_strength="possible",
            disqualified=False,
            **definition,
        )
        for index, (key, definition) in enumerate(PROGRAM_DEFINITIONS.items(), 1)
    ]
