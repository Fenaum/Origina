from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models.user import Role, User, UserRole
from app.schemas.common_schema import PaginatedResponse
from app.schemas.user_schema import UserCreate, UserOut, UserUpdate
from app.security.hash import hash_password
from app.security.roles import IT_ADMIN, require_roles
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/users", tags=["users"])


def _get_or_404(user_id: UUID, db: Session, tenant_id: UUID) -> User:
    """Fetch a user by id with `roles` eager-loaded.

    The `roles` relationship is lazy-loaded by default; without selectinload,
    UserOut's model_validator runs AFTER the session has closed in some code
    paths (e.g. test client + separate request) and returns `[]`. Eager
    loading pulls the join into the same transaction as the user row, so the
    validator sees the roles consistently.
    """
    user = (
        db.query(User)
        .options(selectinload(User.roles).selectinload(UserRole.role))
        .filter(User.id == user_id)
        .first()
    )
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user



# ── /me MUST be declared BEFORE /{user_id} ───────────────────────────────────
# FastAPI resolves routes top-to-bottom; otherwise "me" would parse as a UUID.
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user with roles populated."""
    return current_user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    if db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.email == payload.email,
    ).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        tenant_id=current_user.tenant_id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=PaginatedResponse[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User).filter(User.tenant_id == current_user.tenant_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return PaginatedResponse[UserOut](items=items, total=total)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(user_id, db, current_user.tenant_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    user = _get_or_404(user_id, db, current_user.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    for k, v in updates.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


# ── Role assignment endpoints (admin only) ─────────────────────────────────────

def _get_role_or_404(role_name: str, db: Session, tenant_id: UUID) -> Role:
    role = (
        db.query(Role)
        .filter(Role.tenant_id == tenant_id, Role.name == role_name)
        .first()
    )
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found")
    return role


@router.post("/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(
    user_id: UUID,
    role_name: str,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    """Assign an existing tenant role to a user (idempotent)."""
    _get_or_404(user_id, db, current_user.tenant_id)
    role = _get_role_or_404(role_name, db, current_user.tenant_id)
    existing = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not existing:
        db.add(
            UserRole(
                user_id=user_id,
                role_id=role.id,
                tenant_id=current_user.tenant_id,
            )
        )
        db.commit()
    return None


@router.delete("/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role(
    user_id: UUID,
    role_name: str,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(require_roles(IT_ADMIN)),
):
    """Remove a tenant role from a user (no-op if not assigned)."""
    _get_or_404(user_id, db, current_user.tenant_id)
    role = _get_role_or_404(role_name, db, current_user.tenant_id)
    db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role.id,
        UserRole.tenant_id == current_user.tenant_id,
    ).delete()
    db.commit()
    return None
