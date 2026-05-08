from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.borrowers import Address, Borrower
from app.schemas.borrower_schema import (
    AddressCreate,
    AddressOut,
    BorrowerCreate,
    BorrowerOut,
    BorrowerUpdate,
)


router = APIRouter(tags=["borrowers"])


@router.post("/addresses/", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(payload: AddressCreate, db: Session = Depends(get_db)):
    # Addresses are separated from borrowers so a borrower can have current
    # and mailing addresses without duplicating every address field.
    address = Address(**payload.model_dump())
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.get("/addresses/{address_id}", response_model=AddressOut)
def get_address(address_id: UUID, db: Session = Depends(get_db)):
    address = db.get(Address, address_id)

    if not address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")

    return address


@router.post("/borrowers/", response_model=BorrowerOut, status_code=status.HTTP_201_CREATED)
def create_borrower(payload: BorrowerCreate, db: Session = Depends(get_db)):
    borrower = Borrower(**payload.model_dump())
    db.add(borrower)
    db.commit()
    db.refresh(borrower)
    return borrower


@router.get("/borrowers/", response_model=list[BorrowerOut])
def list_borrowers(
    loan_id: UUID | None = None,
    tenant_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Borrower)

    # These filters let you ask questions like:
    # "show me all borrowers for this loan" or "for this tenant".
    if loan_id:
        query = query.filter(Borrower.loan_id == loan_id)
    if tenant_id:
        query = query.filter(Borrower.tenant_id == tenant_id)

    return query.offset(skip).limit(limit).all()


@router.get("/borrowers/{borrower_id}", response_model=BorrowerOut)
def get_borrower(borrower_id: UUID, db: Session = Depends(get_db)):
    borrower = db.get(Borrower, borrower_id)

    if not borrower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")

    return borrower


@router.patch("/borrowers/{borrower_id}", response_model=BorrowerOut)
def update_borrower(borrower_id: UUID, payload: BorrowerUpdate, db: Session = Depends(get_db)):
    borrower = db.get(Borrower, borrower_id)

    if not borrower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")

    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(borrower, field_name, value)

    db.commit()
    db.refresh(borrower)
    return borrower


@router.delete("/borrowers/{borrower_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_borrower(borrower_id: UUID, db: Session = Depends(get_db)):
    borrower = db.get(Borrower, borrower_id)

    if not borrower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")

    db.delete(borrower)
    db.commit()
    return None
