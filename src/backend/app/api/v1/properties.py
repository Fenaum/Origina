from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.properties import Property
from app.models.user import User
from app.schemas.property_schema import PropertyCreate, PropertyOut, PropertyUpdate
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/properties", tags=["properties"])


def _get_or_404(property_id: UUID, db: Session, tenant_id: UUID) -> Property:
    prop = db.get(Property, property_id)
    if not prop or prop.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.post("/", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    prop = Property(
        tenant_id=current_user.tenant_id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("/", response_model=list[PropertyOut])
def list_properties(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Property).filter(Property.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Property.loan_id == loan_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(property_id, db, current_user.tenant_id)


@router.patch("/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    prop = _get_or_404(property_id, db, current_user.tenant_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(prop, k, v)
    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    prop = _get_or_404(property_id, db, current_user.tenant_id)
    db.delete(prop)
    db.commit()
    return None
