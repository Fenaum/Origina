from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.security.jwt import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_401 = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise _401
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise _401
    return user


def get_audited_db(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Session:
    """Returns the DB session with the audit user ID set for this transaction.

    The 105_audit_triggers.sql trigger reads app.current_user_id so that every
    INSERT/UPDATE/DELETE on audited tables records who made the change.
    SET LOCAL scopes the variable to the current transaction — it clears
    automatically on commit or rollback.
    """
    db.execute(text("SET LOCAL app.current_user_id = :uid"), {"uid": str(current_user.id)})
    return db
