from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.parties import Party
from app.models.user import User
from app.schemas.party_schema import PartyCreate, PartyOut, PartyUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/parties", tags=["parties"])


def _get_or_404(party_id: UUID, db: Session, tenant_id: UUID) -> Party:
    party = db.get(Party, party_id)
    if not party or party.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Party not found")
    return party


@router.post("/", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(
    payload: PartyCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    party = Party(
        tenant_id=current_user.tenant_id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(party)
    db.commit()
    db.refresh(party)
    return party


@router.get("/", response_model=list[PartyOut])
def list_parties(
    party_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Party).filter(Party.tenant_id == current_user.tenant_id)
    if party_type:
        query = query.filter(Party.party_type == party_type)
    return query.offset(skip).limit(limit).all()


@router.get("/{party_id}", response_model=PartyOut)
def get_party(
    party_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(party_id, db, current_user.tenant_id)


@router.patch("/{party_id}", response_model=PartyOut)
def update_party(
    party_id: UUID,
    payload: PartyUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    party = _get_or_404(party_id, db, current_user.tenant_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(party, k, v)
    db.commit()
    db.refresh(party)
    return party


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_party(
    party_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    party = _get_or_404(party_id, db, current_user.tenant_id)
    db.delete(party)
    db.commit()
    return None
