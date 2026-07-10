from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    COOKIE_NAME,
    COOKIE_PATH,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    LOGIN_RATE_LIMIT,
)
from app.core.db import get_db
from app.models.user import User
from app.schemas.user_schema import UserOut
from app.security.hash import verify_password
from app.security.jwt import create_access_token
from app.security.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP rate limiter for /auth/login. Tracked in-process; for a multi-worker
# deployment swap storage_uri to Redis. See slowapi docs.
limiter = Limiter(key_func=get_remote_address)


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(
    request: Request,  # required by slowapi for key_func
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Exchange email + password for a JWT.

    The token is set as an httpOnly cookie (browser-safe — XSS can't read it)
    AND returned in the response body (for API clients and the localStorage
    fallback path during the cookie cutover).

    The slowapi limiter decorates this endpoint with a per-IP rate limit
    (configurable via LOGIN_RATE_LIMIT). Excess attempts get a 429.
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
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=COOKIE_PATH,
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """Clear the httpOnly auth cookie. Safe to call even when no cookie is set."""
    response.delete_cookie(key=COOKIE_NAME, path=COOKIE_PATH)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


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
