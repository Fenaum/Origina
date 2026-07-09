#!/usr/bin/env python3
"""
Seed one user per backend role for the origina-dev tenant.

Run from repo root:
    python3 scripts/seed_roles_and_users.py

Idempotent — safe to re-run. Existing users are skipped, roles are created
on demand, and role assignments use ON CONFLICT DO NOTHING semantics.
"""
import os
import sys
from uuid import UUID

import bcrypt
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://origina:origina123@localhost:5432/originadb",
)

TENANT_NAME = "origina-dev"

# Login credentials — keep in sync with scripts/bootstrap_user.py for the
# admin user, plus one entry per backend role so the front-end sidebar can
# be exercised by role in the demo.
SEED_USERS = [
    {"email": "admin@origina.dev",     "full_name": "Admin User",       "role": "it_admin",        "password": "TestPass123!"},
    {"email": "lo@origina.dev",        "full_name": "Loan Officer",      "role": "loan_officer",    "password": "TestPass123!"},
    {"email": "processor@origina.dev", "full_name": "Processor User",    "role": "loan_processor",  "password": "TestPass123!"},
    {"email": "uw@origina.dev",        "full_name": "Underwriter User",  "role": "underwriter",     "password": "TestPass123!"},
    {"email": "am@origina.dev",        "full_name": "Account Manager",   "role": "account_manager", "password": "TestPass123!"},
]


def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def run() -> None:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Get or create tenant
        cur.execute("SELECT id FROM tenants WHERE name = %s", (TENANT_NAME,))
        row = cur.fetchone()
        if row:
            tenant_id = row[0]
        else:
            cur.execute(
                "INSERT INTO tenants (name) VALUES (%s) RETURNING id",
                (TENANT_NAME,),
            )
            tenant_id = cur.fetchone()[0]
            print(f"Created tenant {TENANT_NAME} ({tenant_id})")

        for user in SEED_USERS:
            cur.execute(
                "SELECT id FROM users WHERE tenant_id = %s AND email = %s",
                (tenant_id, user["email"]),
            )
            existing = cur.fetchone()
            if existing:
                user_id = existing[0]
                print(f"  Skipped (exists): {user['email']}")
            else:
                pw_hash = hash_pw(user["password"])
                cur.execute(
                    """
                    INSERT INTO users (tenant_id, email, full_name, password_hash, is_active)
                    VALUES (%s, %s, %s, %s, true)
                    RETURNING id
                    """,
                    (tenant_id, user["email"], user["full_name"], pw_hash),
                )
                user_id = cur.fetchone()[0]
                print(f"  Created: {user['email']}")

            # Ensure the role exists for the tenant
            cur.execute(
                "SELECT id FROM roles WHERE tenant_id = %s AND name = %s",
                (tenant_id, user["role"]),
            )
            role_row = cur.fetchone()
            if not role_row:
                cur.execute(
                    "INSERT INTO roles (tenant_id, name, description) VALUES (%s, %s, %s) RETURNING id",
                    (tenant_id, user["role"], f"Auto-created for {user['email']}"),
                )
                role_id = cur.fetchone()[0]
                print(f"    Created role '{user['role']}' ({role_id})")
            else:
                role_id = role_row[0]

            # Assign the role (idempotent via ON CONFLICT DO NOTHING on PK)
            cur.execute(
                """
                INSERT INTO user_roles (user_id, role_id, tenant_id)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (user_id, role_id, tenant_id),
            )
        conn.commit()
        print("Done.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run()
