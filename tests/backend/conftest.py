"""
Origina backend pytest fixtures.

See ROADMAP.md "Testing Checkpoints" section A.1 for the design rationale.
Strategy:
  - Tests run against the existing dev Postgres (originadb) using a per-test-run
    schema (`test_origina_<uuid>`) for isolation. The dev tables are copied into
    the test schema at session start, then dropped at session end.
  - No testcontainers, no separate DB. Matches the project's existing
    docker-compose setup.
  - The smoke client fixture (`client`) overrides `get_db` to point at the test
    schema — full app routers are exercised without touching dev data.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest

# ── Make the backend importable ───────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "src" / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# ── Test environment defaults (overridable via conftest env vars) ─────────────
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-do-not-use-in-prod")
os.environ.setdefault("LOG_LEVEL", "warning")

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.config import DATABASE_URL  # noqa: E402
from app.core.db import get_db  # noqa: E402


def _quote_ident(name: str) -> str:
    """Safely quote a Postgres identifier."""
    return '"' + name.replace('"', '""') + '"'


@pytest.fixture(scope="session")
def test_schema_name() -> str:
    """Unique schema name for this test session."""
    return f"test_origina_{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="session")
def test_engine(test_schema_name: str):
    """
    Engine bound to the test schema.

    On session start: create schema, set search_path, create tables via
    SQLAlchemy metadata (good enough for smoke tests; integration tests will
    swap this for the real migration runner when needed).
    On session end: drop schema.
    """
    schema = _quote_ident(test_schema_name)
    engine = create_engine(DATABASE_URL, echo=False)

    with engine.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA {schema}"))
        conn.execute(text(f"SET search_path TO {schema}"))

    # Import models so metadata is populated, then create_all into the schema.
    import app.models  # noqa: F401 — registers all models

    try:
        from app.core.db import Base  # type: ignore[attr-defined]
        metadata = Base.metadata
    except (ImportError, AttributeError):
        from app.models import Base as _Base  # type: ignore
        metadata = _Base.metadata

    with engine.begin() as conn:
        conn.execute(text(f"SET search_path TO {schema}"))
        metadata.create_all(bind=conn)

    yield engine

    with engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    engine.dispose()


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    """SessionLocal bound to the test engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture()
def db(test_engine, test_schema_name):
    """Per-test DB session with search_path pinned to the test schema."""
    schema = _quote_ident(test_schema_name)
    session = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)()
    session.execute(text(f"SET search_path TO {schema}"))
    try:
        yield session
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app client — overrides get_db to point at the test schema
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
async def client(test_engine, test_schema_name):
    """
    Async httpx client bound to the FastAPI app with `get_db` overridden.

    httpx 0.28+ ships `ASGITransport` as fully async — no sync `handle_request`,
    no `__enter__`/`close`. The cleanest path is therefore to make the
    fixture async and yield an `httpx.AsyncClient`.

    Test functions using this fixture should themselves be `async def`. With
    `asyncio_mode=auto` (see pytest.ini) pytest-asyncio will run them
    automatically.

    Why not the older sync `httpx.Client(app=app)` pattern?
      It was removed in httpx 0.28. https://github.com/encode/httpx/pull/3212
    """
    import httpx
    from app.core.main import app

    schema = _quote_ident(test_schema_name)

    def _override_get_db():
        s = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)()
        s.execute(text(f"SET search_path TO {schema}"))
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: minimal seed data (stub)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def seed_minimum(db):
    """
    Seeds the minimum data needed for integration tests:
      - one tenant
      - one admin user (it_admin role)
      - returns the user info + a fresh JWT

    Tests that need a second tenant should mark themselves `skip` until
    multi-tenant seed is implemented.
    """
    import bcrypt
    from app.security.jwt import create_access_token

    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    role_id = uuid.uuid4()
    pw_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode()
    # `tenants.name` has a UNIQUE constraint, so the seed must use a fresh name
    # per test. We suffix with the tenant id suffix so test logs are traceable.
    tenant_name = f"Test Lender {tenant_id.hex[:8]}"

    # Tenant model (see app/models/user.py) only carries `name` + the UUID/timestamp
    # mixins. The `slug` column is added later by a migration. Insert only the
    # columns that the ORM maps, otherwise the metadata.create_all schema in the
    # test fixture will reject the insert.
    db.execute(
        text("INSERT INTO tenants (id, name) VALUES (:id, :name)"),
        {"id": tenant_id, "name": tenant_name},
    )

    db.execute(
        text(
            "INSERT INTO roles (id, tenant_id, name, description) "
            "VALUES (:id, :tid, :name, :desc)"
        ),
        {
            "id": role_id,
            "tid": tenant_id,
            "name": "it_admin",
            "desc": "Test admin",
        },
    )

    db.execute(
        text(
            "INSERT INTO users (id, tenant_id, email, password_hash, full_name, is_active) "
            "VALUES (:id, :tid, :email, :pw, :name, true)"
        ),
        {
            "id": user_id,
            "tid": tenant_id,
            "email": "test@origina.dev",
            "pw": pw_hash,
            "name": "Test Admin",
        },
    )

    db.execute(
        text(
            "INSERT INTO user_roles (user_id, role_id, tenant_id) "
            "VALUES (:uid, :rid, :tid)"
        ),
        {"uid": user_id, "rid": role_id, "tid": tenant_id},
    )

    db.commit()

    token = create_access_token(user_id, tenant_id)
    return {
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "role_id": str(role_id),
        "token": token,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Skip markers — graceful degradation when DATABASE_URL is missing
# ─────────────────────────────────────────────────────────────────────────────

def pytest_collection_modifyitems(config, items):
    """Skip @pytest.mark.integration tests when DATABASE_URL is not set."""
    if os.getenv("DATABASE_URL"):
        return
    skip_db = pytest.mark.skip(reason="DATABASE_URL not set — integration tests skipped")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_db)