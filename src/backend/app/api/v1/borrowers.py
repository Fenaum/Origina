from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.borrowers import Address, Borrower
from app.models.user import User
from app.schemas.borrower_schema import AddressCreate, AddressOut, BorrowerCreate, BorrowerOut, BorrowerUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(tags=["borrowers"])


# ── Addresses ──────────────────────────────────────────────────────────────────

@router.post("/addresses/", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    address = Address(
        tenant_id=current_user.tenant_id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.get("/addresses/{address_id}", response_model=AddressOut)
def get_address(
    address_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    address = db.get(Address, address_id)
    if not address or address.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Address not found")
    return address


# ── Borrowers ──────────────────────────────────────────────────────────────────

@router.post("/borrowers/", response_model=BorrowerOut, status_code=status.HTTP_201_CREATED)
def create_borrower(
    payload: BorrowerCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    borrower = Borrower(
        tenant_id=current_user.tenant_id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(borrower)
    db.commit()
    db.refresh(borrower)
    return borrower


@router.get("/borrowers/", response_model=list[BorrowerOut])
def list_borrowers(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Borrower).filter(Borrower.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Borrower.loan_id == loan_id)
    return query.offset(skip).limit(limit).all()


@router.get("/borrowers/{borrower_id}", response_model=BorrowerOut)
def get_borrower(
    borrower_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    borrower = db.get(Borrower, borrower_id)
    if not borrower or borrower.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return borrower


@router.patch("/borrowers/{borrower_id}", response_model=BorrowerOut)
def update_borrower(
    borrower_id: UUID,
    payload: BorrowerUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    borrower = db.get(Borrower, borrower_id)
    if not borrower or borrower.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Borrower not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(borrower, k, v)
    db.commit()
    db.refresh(borrower)
    return borrower


@router.delete("/borrowers/{borrower_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_borrower(
    borrower_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    borrower = db.get(Borrower, borrower_id)
    if not borrower or borrower.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Borrower not found")
    db.delete(borrower)
    db.commit()
    return None
