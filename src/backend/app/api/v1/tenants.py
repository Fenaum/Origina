from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import ADMIN_SECRET
from app.core.db import get_db
from app.models.user import Role, Tenant, User, UserRole
from app.schemas.common_schema import PaginatedResponse
from app.schemas.user_schema import TenantCreate, TenantOut
from app.security.hash import hash_password
from app.security.security import get_current_user


router = APIRouter(prefix="/tenants", tags=["tenants"])


# ── Bootstrap ─────────────────────────────────────────────────────────────────
# Sprint 5 §5.3 — IT_ADMIN-only tenant onboarding. A new lender can be
# brought online in under a minute: one POST creates the tenant + first
# admin user + assigns the it_admin role.
#
# Guard: ADMIN_SECRET (env var). When unset the endpoint returns 503 so an
# accidentally-deployed environment cannot be used to bootstrap tenants
# without explicit operator consent.

class BootstrapTenantRequest(BaseModel):
    tenant_name: str
    admin_email: str
    admin_full_name: str
    admin_password: str
    admin_secret: str


class BootstrapTenantResponse(BaseModel):
    tenant_id: UUID
    user_id: UUID
    email: str
    message: str


@router.post("/bootstrap", response_model=BootstrapTenantResponse, status_code=status.HTTP_201_CREATED)
def bootstrap_tenant(payload: BootstrapTenantRequest, db: Session = Depends(get_db)):
    """Create a tenant + its first IT_ADMIN in a single atomic call.

    Disabled (503) when ADMIN_SECRET is not configured. The caller must send
    the same secret in the request body — a proof-of-control handshake that
    prevents anonymous tenant creation.

    The first user is granted the it_admin role for the new tenant. After
    the call returns, the admin can log in via /auth/login and start
    inviting loan officers, processors, underwriters, etc.
    """
    if not ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tenant bootstrap is disabled (ADMIN_SECRET not set)",
        )
    if payload.admin_secret != ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin secret",
        )
    if db.query(Tenant).filter(Tenant.name == payload.tenant_name).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant '{payload.tenant_name}' already exists",
        )

    tenant = Tenant(name=payload.tenant_name)
    db.add(tenant)
    db.flush()  # assign tenant.id before creating the user row

    user = User(
        tenant_id=tenant.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        password_hash=hash_password(payload.admin_password),
        is_active=True,
    )
    db.add(user)
    db.flush()  # assign user.id before creating user_roles row

    # Ensure the it_admin role exists for this tenant. Production tenants get
    # the five canonical roles via migration 020, but a freshly-bootstrapped
    # tenant has no rows yet — creating the role here makes the endpoint
    # self-contained so it works whether the schema was migrated or not.
    admin_role = (
        db.query(Role)
        .filter(Role.tenant_id == tenant.id, Role.name == "it_admin")
        .first()
    )
    if not admin_role:
        admin_role = Role(
            tenant_id=tenant.id,
            name="it_admin",
            description="IT administrator with full tenant access",
        )
        db.add(admin_role)
        db.flush()
    db.add(UserRole(user_id=user.id, role_id=admin_role.id, tenant_id=tenant.id))

    db.commit()
    db.refresh(tenant)
    db.refresh(user)

    return BootstrapTenantResponse(
        tenant_id=tenant.id,
        user_id=user.id,
        email=user.email,
        message=f"Tenant '{payload.tenant_name}' created. Admin login: {user.email}",
    )


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
