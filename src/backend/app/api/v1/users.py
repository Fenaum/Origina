from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.user_schema import UserCreate, UserOut, UserUpdate
from app.security.hash import hash_password
from app.security.security import get_audited_db, get_current_user

router = APIRouter(prefix="/users", tags=["users"])


def _get_or_404(user_id: UUID, db: Session, tenant_id: UUID) -> User:
    user = db.get(User, user_id)
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
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
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(User)
        .filter(User.tenant_id == current_user.tenant_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


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
