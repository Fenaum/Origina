from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.schemas.user_schema import UserOut
from app.security.hash import verify_password
from app.security.jwt import create_access_token
from app.security.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Exchange email + password for a JWT bearer token.

    Uses OAuth2PasswordRequestForm so /docs renders a login form.
    The 'username' field is the OAuth2 spec name — we treat it as email.
    """
    user = (
        db.query(User)
        .filter(User.email == form.username, User.is_active == True)  # noqa: E712
        .first()
    )
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.id, user.tenant_id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's own profile."""
    return {
        "id": current_user.id,
        "tenant_id": current_user.tenant_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "roles": [ur.role.name for ur in current_user.roles],
    }
