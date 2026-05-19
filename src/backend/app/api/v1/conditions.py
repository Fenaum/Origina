from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.conditions import Condition
from app.schemas.condition_schema import ConditionCreate, ConditionOut, ConditionUpdate


router = APIRouter(prefix="/conditions", tags=["conditions"])


@router.post("/", response_model=ConditionOut, status_code=status.HTTP_201_CREATED)
def create_condition(payload: ConditionCreate, db: Session = Depends(get_db)):
    # A condition is a requirement tied to one loan.
    # Example: "Upload bank statements" or "Verify employment".
    condition = Condition(**payload.model_dump())
    db.add(condition)
    db.commit()
    db.refresh(condition)
    return condition


@router.get("/", response_model=list[ConditionOut])
def list_conditions(
    loan_id: UUID | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Condition)

    if loan_id:
        query = query.filter(Condition.loan_id == loan_id)
    if status_filter:
        query = query.filter(Condition.status == status_filter)

    return query.offset(skip).limit(limit).all()


@router.get("/{condition_id}", response_model=ConditionOut)
def get_condition(condition_id: UUID, db: Session = Depends(get_db)):
    condition = db.get(Condition, condition_id)

    if not condition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condition not found")

    return condition


@router.patch("/{condition_id}", response_model=ConditionOut)
def update_condition(condition_id: UUID, payload: ConditionUpdate, db: Session = Depends(get_db)):
    condition = db.get(Condition, condition_id)

    if not condition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condition not found")

    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(condition, field_name, value)

    db.commit()
    db.refresh(condition)
    return condition


@router.delete("/{condition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_condition(condition_id: UUID, db: Session = Depends(get_db)):
    condition = db.get(Condition, condition_id)

    if not condition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condition not found")

    db.delete(condition)
    db.commit()
    return None
