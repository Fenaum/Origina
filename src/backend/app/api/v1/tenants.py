from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import Tenant, User
from app.schemas.common_schema import PaginatedResponse
from app.schemas.user_schema import TenantCreate, TenantOut
from app.security.security import get_current_user


router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    """Create a new tenant. No auth required so bootstrap is possible from the CLI."""
    if db.query(Tenant).filter(Tenant.name == payload.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant name already exists")
    tenant = Tenant(name=payload.name)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/", response_model=PaginatedResponse[TenantOut])
def list_tenants(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Tenant)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return PaginatedResponse[TenantOut](items=items, total=total)



@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
