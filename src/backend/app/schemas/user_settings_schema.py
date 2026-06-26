from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── User preferences ────────────────────────────────────────────────────────────

class UserPreferencesBase(BaseModel):
    density: Optional[str] = Field("default", description="Table density: compact | default | spacious")
    default_view: Optional[str] = Field("pipeline", description="Default landing page: pipeline | dashboard | ...")
    reduced_motion: Optional[bool] = Field(False, description="Disable CSS animations")
    theme: Optional[str] = Field("system", description="Color theme: light | dark | system")


class UserNotificationPreferencesBase(BaseModel):
    email_digest: Optional[str] = Field("daily", description="Email digest: none | daily | weekly | real_time")
    mention_alerts: Optional[bool] = True
    escalation_alerts: Optional[bool] = True
    quiet_hours_enabled: Optional[bool] = False
    quiet_hours_start: Optional[str] = Field("22:00", description="HH:MM in 24h format")
    quiet_hours_end: Optional[str] = Field("08:00", description="HH:MM in 24h format")


# ── Current user (GET /users/me) ───────────────────────────────────────────────

class UserMeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: str = "en-US"
    timezone: str = "America/Chicago"
    bio: Optional[str] = None
    mfa_enabled: bool = False
    is_active: bool = True
    created_at: datetime
    roles: list[str] = []


class UserMeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None
    bio: Optional[str] = None
    signature: Optional[str] = None


class UserPreferencesUpdate(UserPreferencesBase):
    pass


class UserNotificationPreferencesUpdate(UserNotificationPreferencesBase):
    pass


# ── Password change ──────────────────────────────────────────────────────────────

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


# ── User sessions ───────────────────────────────────────────────────────────────

class UserSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    last_active_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    created_at: datetime

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > datetime.utcnow()


# ── Tenant / organization settings ──────────────────────────────────────────────

class TenantSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    logo_url: Optional[str] = None
    primary_color: str = "#4ade80"
    support_email: Optional[str] = None
    business_hours: dict = {}
    audit_retention_days: int = 2555
    mfa_required: bool = False
    created_at: datetime


class TenantSettingsUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    support_email: Optional[EmailStr] = None
    business_hours: Optional[dict] = None
    audit_retention_days: Optional[int] = Field(None, ge=30, le=3650)
    mfa_required: Optional[bool] = None
    defaults: Optional[dict] = None
