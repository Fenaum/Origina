from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.loan import Loan
from app.schemas.loan_schema import LoanCreate, LoanOut, LoanUpdate


# APIRouter groups related endpoints together.
# main.py will attach this router to the FastAPI app with a URL prefix.
router = APIRouter(prefix="/loans", tags=["loans"])


@router.post("/", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)):
    # payload is already validated by Pydantic before this function runs.
    # model_dump() converts the Pydantic object into a normal Python dict.
    loan = Loan(**payload.model_dump())

    # Add the new object to the database session.
    db.add(loan)

    # commit() sends the INSERT to the database.
    db.commit()

    # refresh() reloads generated fields like id, created_at, and defaults.
    db.refresh(loan)
    return loan


@router.get("/", response_model=list[LoanOut])
def list_loans(
    tenant_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    # Start with a query for every loan.
    query = db.query(Loan)

    # Optional query parameter:
    # /loans/?tenant_id=<uuid> returns only loans for that tenant.
    if tenant_id:
        query = query.filter(Loan.tenant_id == tenant_id)

    # offset/limit are basic pagination controls.
    return query.offset(skip).limit(limit).all()


@router.get("/{loan_id}", response_model=LoanOut)
def get_loan(loan_id: UUID, db: Session = Depends(get_db)):
    # db.get(Model, primary_key) is the simple way to load one row by id.
    loan = db.get(Loan, loan_id)

    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    return loan


@router.patch("/{loan_id}", response_model=LoanOut)
def update_loan(loan_id: UUID, payload: LoanUpdate, db: Session = Depends(get_db)):
    loan = db.get(Loan, loan_id)

    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    # exclude_unset=True means "only fields the client actually sent".
    # That keeps PATCH from overwriting fields with None by accident.
    updates = payload.model_dump(exclude_unset=True)

    for field_name, value in updates.items():
        setattr(loan, field_name, value)

    db.commit()
    db.refresh(loan)
    return loan


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(loan_id: UUID, db: Session = Depends(get_db)):
    loan = db.get(Loan, loan_id)

    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")

    db.delete(loan)
    db.commit()

    # 204 responses intentionally return no body.
    return None
