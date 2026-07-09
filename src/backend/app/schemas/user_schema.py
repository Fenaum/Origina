from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


class TenantBase(BaseModel):
    name: str


class TenantCreate(TenantBase):
    pass


class TenantOut(TenantBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserCreate(UserBase):
    # tenant_id is intentionally absent — the endpoint injects it from the
    # authenticated user's JWT. Clients must not send it.
    password: str


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    roles: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def extract_role_names(cls, data: object) -> object:
        """Resolve the User.roles relationship (list[UserRole]) into a list of
        role-name strings. SQLAlchemy gives us UserRole rows; we want the .name
        attribute on each .role so the API contract stays flat (UserOut.roles
        is list[str], not nested objects).

        Also tolerates:
          - dict payloads (already shaped) — passed through
          - already-string lists (returned by auth.py /users/me handler)

        Returns a dict that Pydantic will feed into the field-by-field
        parsers. Mutating SQLAlchemy ORM objects in-place is fragile because
        `roles` is a managed descriptor; returning a fresh dict sidesteps that.
        """
        # Dict path — already shaped. Pass through.
        if isinstance(data, dict):
            return data

        # ORM path — extract role names. We need UserRole.role.name. We assume
        # callers have eager-loaded the relationship (see users._get_or_404);
        # if they didn't, accessing .roles raises DetachedInstanceError, which
        # we catch and treat as "no roles".
        role_names: list[str] = []
        try:
            role_objs = getattr(data, "roles", []) or []
            for ur in role_objs:
                role = getattr(ur, "role", None)
                if role is not None:
                    name = getattr(role, "name", None)
                    if name:
                        role_names.append(name)
        except Exception:
            role_names = []

        # Materialize a plain dict that mirrors the ORM object's attributes
        # so Pydantic's from_attributes-style mapping sees the right shape.
        # `getattr(orm_obj, attr)` reads both column attributes and (now-set)
        # scalar relationships, but `roles` is the only one that needs
        # translation; everything else is scalar and copies through.
        out: dict = {}
        for field_name in cls.model_fields:
            if field_name == "roles":
                out[field_name] = role_names
                continue
            try:
                out[field_name] = getattr(data, field_name)
            except Exception:
                # Field absent on this object — leave default.
                pass
        return out



class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    tenant_id: UUID


class RoleOut(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
