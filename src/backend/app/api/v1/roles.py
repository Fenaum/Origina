from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import Role, User, UserRole
from app.schemas.user_schema import RoleCreate, RoleOut
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/roles", tags=["roles"])


def _get_or_404(role_id: UUID, db: Session, tenant_id: UUID) -> Role:
    role = db.get(Role, role_id)
    if not role or role.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Role).filter(
        Role.tenant_id == current_user.tenant_id,
        Role.name == payload.name,
    ).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role name already exists")
    role = Role(tenant_id=current_user.tenant_id, name=payload.name, description=payload.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/", response_model=list[RoleOut])
def list_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Role)
        .filter(Role.tenant_id == current_user.tenant_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{role_id}", response_model=RoleOut)
def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(role_id, db, current_user.tenant_id)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    role = _get_or_404(role_id, db, current_user.tenant_id)
    db.delete(role)
    db.commit()
    return None


@router.post("/{role_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(
    role_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    role = _get_or_404(role_id, db, current_user.tenant_id)
    target = db.get(User, user_id)
    if not target or target.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(UserRole).filter(
        UserRole.role_id == role_id,
        UserRole.user_id == user_id,
        UserRole.tenant_id == current_user.tenant_id,
    ).first()
    if not existing:
        db.add(UserRole(tenant_id=current_user.tenant_id, user_id=user_id, role_id=role.id))
        db.commit()
    return None


@router.delete("/{role_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role(
    role_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    _get_or_404(role_id, db, current_user.tenant_id)
    link = db.query(UserRole).filter(
        UserRole.role_id == role_id,
        UserRole.user_id == user_id,
        UserRole.tenant_id == current_user.tenant_id,
    ).first()
    if link:
        db.delete(link)
        db.commit()
    return None
