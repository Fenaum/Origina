"""Settings routes for the current authenticated user: profile, preferences, security, sessions."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.security.security import get_audited_db
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.user_settings_schema import (
    PasswordChange,
    UserMeOut,
    UserMeUpdate,
    UserNotificationPreferencesUpdate,
    UserPreferencesUpdate,
    UserSessionOut,
)
from app.security.hash import hash_password, verify_password
from app.security.security import get_current_user

router = APIRouter(prefix="/users/me", tags=["users-me"])


def _user_me_out(user: User) -> UserMeOut:
    return UserMeOut(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        full_name=user.full_name,
        phone=getattr(user, "phone", None),
        title=getattr(user, "title", None),
        avatar_url=getattr(user, "avatar_url", None),
        locale=getattr(user, "locale", "en-US"),
        timezone=getattr(user, "timezone", "America/Chicago"),
        bio=getattr(user, "bio", None),
        mfa_enabled=getattr(user, "mfa_enabled", False),
        is_active=user.is_active,
        created_at=user.created_at,
        roles=[ur.role.name for ur in user.roles],
    )


@router.get("", response_model=UserMeOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's full profile including extended settings fields."""
    return _user_me_out(current_user)


@router.patch("", response_model=UserMeOut)
def update_me(
    payload: UserMeUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (name, phone, title, avatar, bio, etc.)."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return _user_me_out(current_user)


# ── Preferences ────────────────────────────────────────────────────────────────

@router.patch("/preferences", response_model=UserMeOut)
def update_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Merge new preferences into the existing JSONB preferences column."""
    current = dict(getattr(current_user, "preferences", {}) or {})
    current.update(payload.model_dump(exclude_unset=True))
    current_user.preferences = current
    db.commit()
    db.refresh(current_user)
    return _user_me_out(current_user)


# ── Notification preferences ────────────────────────────────────────────────────

@router.patch("/notifications", response_model=UserMeOut)
def update_notifications(
    payload: UserNotificationPreferencesUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Merge new notification preferences into the JSONB column."""
    current = dict(getattr(current_user, "notification_preferences", {}) or {})
    current.update(payload.model_dump(exclude_unset=True))
    current_user.notification_preferences = current
    db.commit()
    db.refresh(current_user)
    return _user_me_out(current_user)


# ── Password ───────────────────────────────────────────────────────────────────

@router.post("/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password. Requires the current password."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ── Sessions ───────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[UserSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active sessions for the current user (excludes revoked)."""
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_user.id,
            UserSession.revoked_at.is_(None),
        )
        .order_by(UserSession.last_active_at.desc())
        .all()
    )


@router.post("/sessions/revoke-all")
def revoke_all_sessions(
    request: Request,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke all sessions for the current user except the current one."""
    # Extract current IP from request
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    now = datetime.now(timezone.utc)
    # Revoke all existing sessions
    db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.revoked_at.is_(None),
    ).update({"revoked_at": now})

    # Create a new session record for this login
    new_session = UserSession(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=ip,
        user_agent=user_agent,
        last_active_at=now,
        expires_at=now + timedelta(days=30),
    )
    db.add(new_session)
    db.commit()
    return {"message": "All other sessions revoked"}


@router.post("/sessions/{session_id}/revoke")
def revoke_session(
    session_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a specific session by ID."""
    session = db.get(UserSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.revoked_at:
        raise HTTPException(status_code=400, detail="Session already revoked")
    session.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Session revoked"}
