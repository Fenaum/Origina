#!/usr/bin/env python3
"""
Bootstrap a login-ready user for local testing.

Usage (from repo root):
    python3 scripts/bootstrap_user.py

What it does:
  1. Uses the first existing tenant, or creates one named "origina-dev".
  2. Creates (or updates) a user with the given email and a proper bcrypt hash.
  3. Prints the credentials so you can paste them into /docs or curl.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "src", "backend", ".env"))
load_dotenv()  # also check repo root .env

from app.core.db import SessionLocal
from app.models.user import Role, Tenant, User, UserRole
from app.security.hash import hash_password

EMAIL    = "admin@origina.dev"
PASSWORD = "TestPass123!"
NAME     = "Admin User"

db = SessionLocal()
try:
    # ── Tenant ────────────────────────────────────────────────────────────────
    tenant = db.query(Tenant).first()
    if not tenant:
        tenant = Tenant(name="origina-dev")
        db.add(tenant)
        db.flush()
        print(f"  created tenant: {tenant.name} ({tenant.id})")
    else:
        print(f"  using existing tenant: {tenant.name} ({tenant.id})")

    # ── User ──────────────────────────────────────────────────────────────────
    user = db.query(User).filter(
        User.tenant_id == tenant.id,
        User.email == EMAIL,
    ).first()

    if user:
        user.password_hash = hash_password(PASSWORD)
        user.is_active = True
        action = "updated"
    else:
        user = User(
            tenant_id=tenant.id,
            email=EMAIL,
            full_name=NAME,
            password_hash=hash_password(PASSWORD),
            is_active=True,
        )
        db.add(user)
        action = "created"

    db.commit()
    db.refresh(user)

    # ── Role ──────────────────────────────────────────────────────────────────
    role = db.query(Role).filter(
        Role.tenant_id == tenant.id,
        Role.name == "it_admin",
    ).first()
    if not role:
        role = Role(tenant_id=tenant.id, name="it_admin", description="Platform administrator")
        db.add(role)
        db.flush()
        print(f"  created role: {role.name} ({role.id})")
    else:
        print(f"  using existing role: {role.name} ({role.id})")

    existing_link = db.query(UserRole).filter(
        UserRole.user_id == user.id,
        UserRole.role_id == role.id,
        UserRole.tenant_id == tenant.id,
    ).first()
    if not existing_link:
        db.add(UserRole(user_id=user.id, role_id=role.id, tenant_id=tenant.id))
        db.commit()
        print(f"  assigned role '{role.name}' to {user.email}")
    else:
        print(f"  role '{role.name}' already assigned to {user.email}")

    print(f"\n  {action} user: {user.email} ({user.id})")
    print(f"\n{'─'*50}")
    print("  Ready to test login:")
    print(f"    email:    {EMAIL}")
    print(f"    password: {PASSWORD}")
    print(f"    tenant:   {tenant.name}")
    print(f"\n  POST /api/v1/auth/login")
    print(f"    username={EMAIL}&password={PASSWORD}")
    print(f"{'─'*50}\n")

except Exception as e:
    db.rollback()
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    db.close()
