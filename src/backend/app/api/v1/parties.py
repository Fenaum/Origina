from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.parties import Party
from app.schemas.party_schema import PartyCreate, PartyOut, PartyUpdate


router = APIRouter(prefix="/parties", tags=["parties"])


@router.post("/", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(payload: PartyCreate, db: Session = Depends(get_db)):
    # A party can be a person or a company.
    # The database stores both shapes in one table with nullable fields.
    party = Party(**payload.model_dump())
    db.add(party)
    db.commit()
    db.refresh(party)
    return party


@router.get("/", response_model=list[PartyOut])
def list_parties(
    tenant_id: UUID | None = None,
    party_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Party)

    if tenant_id:
        query = query.filter(Party.tenant_id == tenant_id)
    if party_type:
        query = query.filter(Party.party_type == party_type)

    return query.offset(skip).limit(limit).all()


@router.get("/{party_id}", response_model=PartyOut)
def get_party(party_id: UUID, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)

    if not party:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    return party


@router.patch("/{party_id}", response_model=PartyOut)
def update_party(party_id: UUID, payload: PartyUpdate, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)

    if not party:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(party, field_name, value)

    db.commit()
    db.refresh(party)
    return party


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_party(party_id: UUID, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)

    if not party:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    db.delete(party)
    db.commit()
    return None
