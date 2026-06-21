"""
Controlled-values metadata API.

Serves the contents of controlled_value_sets / controlled_values tables.
Tenant-level rows shadow system rows with the same code, allowing label
customization and extensions without a code deploy or DB migration.

Consumers (frontend, integrations) should call these endpoints instead of
duplicating the controlled-value lists in client-side constants.
"""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.security.security import get_current_user

router = APIRouter(prefix="/metadata", tags=["metadata"])

# ── ORM-free models (raw SQL to avoid circular deps) ──────────────────────────

def _system_values(db: Session, set_code: str) -> list[dict]:
    rows = db.execute(
        __import__("sqlalchemy").text(
            "SELECT code, label, description, sort_order, is_active, metadata "
            "FROM controlled_values "
            "WHERE set_code = :set_code AND tenant_id IS NULL "
            "ORDER BY sort_order, code"
        ),
        {"set_code": set_code},
    ).mappings().all()
    return [dict(r) for r in rows]


def _tenant_values(db: Session, set_code: str, tenant_id: UUID) -> list[dict]:
    rows = db.execute(
        __import__("sqlalchemy").text(
            "SELECT code, label, description, sort_order, is_active, metadata "
            "FROM controlled_values "
            "WHERE set_code = :set_code AND tenant_id = :tenant_id "
            "ORDER BY sort_order, code"
        ),
        {"set_code": set_code, "tenant_id": str(tenant_id)},
    ).mappings().all()
    return [dict(r) for r in rows]


def _merge(system: list[dict], tenant: list[dict]) -> list[dict]:
    """Tenant rows shadow system rows with the same code; tenant additions are appended."""
    by_code = {r["code"]: r for r in system}
    for row in tenant:
        by_code[row["code"]] = row  # shadow or add
    # Re-sort by sort_order then code
    return sorted(by_code.values(), key=lambda r: (r["sort_order"], r["code"]))


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/sets")
def list_sets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all controlled value set codes and descriptions."""
    rows = db.execute(
        __import__("sqlalchemy").text(
            "SELECT code, scope, description FROM controlled_value_sets ORDER BY code"
        )
    ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/values/{set_code}")
def get_values(
    set_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return active controlled values for a set, merging system defaults
    with tenant-level overrides/extensions.
    """
    system = _system_values(db, set_code)
    tenant = _tenant_values(db, set_code, current_user.tenant_id)
    merged = _merge(system, tenant)
    return [r for r in merged if r["is_active"]]


@router.get("/values")
def get_all_values(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return ALL controlled values grouped by set, merged with tenant overrides.
    Useful for a single bootstrap fetch on app load.
    """
    sets_rows = db.execute(
        __import__("sqlalchemy").text(
            "SELECT code FROM controlled_value_sets ORDER BY code"
        )
    ).scalars().all()

    result: dict[str, list[dict]] = {}
    for set_code in sets_rows:
        system = _system_values(db, set_code)
        tenant = _tenant_values(db, set_code, current_user.tenant_id)
        merged = _merge(system, tenant)
        result[set_code] = [r for r in merged if r["is_active"]]

    return result
