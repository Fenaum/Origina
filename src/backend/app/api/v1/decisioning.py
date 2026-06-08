from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.decisioning import EligibilityRun, PricingRun
from app.models.user import User
from app.schemas.decisioning_schema import (
    EligibilityRunCreate,
    EligibilityRunOut,
    PricingRunCreate,
    PricingRunOut,
)
from app.security.security import get_audited_db, get_current_user

router = APIRouter(tags=["decisioning"])


# ── Pricing Runs ───────────────────────────────────────────────────────────────

@router.post("/pricing-runs/", response_model=PricingRunOut, status_code=status.HTTP_201_CREATED)
def create_pricing_run(
    payload: PricingRunCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    run = PricingRun(
        tenant_id=current_user.tenant_id,
        run_by=current_user.id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("/pricing-runs/", response_model=list[PricingRunOut])
def list_pricing_runs(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PricingRun).filter(PricingRun.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(PricingRun.loan_id == loan_id)
    return query.order_by(PricingRun.run_at.desc()).offset(skip).limit(limit).all()


@router.get("/pricing-runs/{run_id}", response_model=PricingRunOut)
def get_pricing_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.get(PricingRun, run_id)
    if not run or run.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Pricing run not found")
    return run


# ── Eligibility Runs ───────────────────────────────────────────────────────────

@router.post("/eligibility-runs/", response_model=EligibilityRunOut, status_code=status.HTTP_201_CREATED)
def create_eligibility_run(
    payload: EligibilityRunCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    run = EligibilityRun(
        tenant_id=current_user.tenant_id,
        run_by=current_user.id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("/eligibility-runs/", response_model=list[EligibilityRunOut])
def list_eligibility_runs(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EligibilityRun).filter(EligibilityRun.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(EligibilityRun.loan_id == loan_id)
    return query.order_by(EligibilityRun.run_at.desc()).offset(skip).limit(limit).all()


@router.get("/eligibility-runs/{run_id}", response_model=EligibilityRunOut)
def get_eligibility_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.get(EligibilityRun, run_id)
    if not run or run.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Eligibility run not found")
    return run
