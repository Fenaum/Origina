"""Capital Markets (CM) PoC models.

Per docs/CAPITAL_MARKETS_WORKSPACE_ARCHITECTURE.md §14 and the 8 CM ADRs
in docs/DECISIONS.md (added 2026-08-04). This module is the ORM surface for
the CM foundation (migrations 135–139). It does NOT depend on the pricing-
plan artifacts (migrations 132–134) — see the Lock-as-Artifact ADR and the
Milestone-1 PIN 1 standalone constraint.

All status / type columns are TEXT + CHECK (no PostgreSQL ENUMs — see the
"PostgreSQL TEXT + CHECK Instead of ENUM Types" ADR). Status constants here
mirror the DB CHECK whitelists and are the single source of truth on the
Python side, matching the existing conditions.py / events.py idiom.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AppendOnlyModel, BaseModel


# ── 1. Status / type constants (mirror DB CHECK whitelists) ────────────────────

class InvestorStatus:
    ACTIVE     = "active"
    SUSPENDED  = "suspended"
    OFFBOARDED = "offboarded"
    ALL: frozenset[str] = frozenset({"active", "suspended", "offboarded"})


class InvestorProgramStatus:
    ACTIVE  = "active"
    PAUSED  = "paused"
    RETIRED = "retired"
    ALL: frozenset[str] = frozenset({"active", "paused", "retired"})


class OverlaySeverity:
    BLOCK = "block"
    WARN  = "warn"
    ALL: frozenset[str] = frozenset({"block", "warn"})


class OverlayOp:
    LE = "<="
    LT = "<"
    EQ = "="
    GT = ">"
    GE = ">="
    IN = "in"
    NOT_IN = "not_in"
    ALL: frozenset[str] = frozenset({"<=", "<", "=", ">", ">=", "in", "not_in"})


class RateSheetChannel:
    ORIGINA = "origina"
    BROKER  = "broker"
    TPO     = "tpo"
    ALL: frozenset[str] = frozenset({"origina", "broker", "tpo"})


class RateSheetStatus:
    DRAFT            = "draft"
    PENDING_APPROVAL = "pending_approval"
    PUBLISHED        = "published"
    SUPERSEDED       = "superseded"
    WITHDRAWN        = "withdrawn"
    ALL: frozenset[str] = frozenset({
        "draft", "pending_approval", "published", "superseded", "withdrawn",
    })


class LockStatus:
    """Per ADR 3: lock lifecycle.
       requested → confirmed → (reprice_required ⇄) → extended* → expired / cancelled / funded_delivered
       Relocks write a new row chained via prior_lock_id (does not change status).
    """
    REQUESTED        = "requested"
    CONFIRMED        = "confirmed"
    REPRICE_REQUIRED = "reprice_required"
    EXTENDED         = "extended"
    EXPIRED          = "expired"
    CANCELLED        = "cancelled"
    FUNDED_DELIVERED = "funded_delivered"
    ALL: frozenset[str] = frozenset({
        "requested", "confirmed", "reprice_required", "extended",
        "expired", "cancelled", "funded_delivered",
    })
    # Rows considered "active" (one-per-loan enforced via partial unique index)
    ACTIVE: frozenset[str] = frozenset({
        "requested", "confirmed", "reprice_required", "extended",
    })


class LockEventType:
    """Per ADR 3: state-transition events on a lock (vs the resulting status
       which lives on cm_locks). Mirrors the loan_status_events precedent.
    """
    REQUESTED        = "requested"
    CONFIRMED        = "confirmed"
    REPRICE_FLAGGED  = "reprice_flagged"
    REPRICED         = "repriced"
    EXTENDED         = "extended"
    EXPIRED          = "expired"
    CANCELLED        = "cancelled"
    FUNDED_DELIVERED = "funded_delivered"
    ALL: frozenset[str] = frozenset({
        "requested", "confirmed", "reprice_flagged", "repriced",
        "extended", "expired", "cancelled", "funded_delivered",
    })


class MaterialChangeImpact:
    RATE           = "rate"
    PRICE          = "price"
    ELIGIBILITY    = "eligibility"
    BEST_EX_RANK   = "best_ex_rank"
    ALL: frozenset[str] = frozenset({"rate", "price", "eligibility", "best_ex_rank"})


class MaterialChangeSeverity:
    WARN  = "warn"
    BLOCK = "block"
    ALL: frozenset[str] = frozenset({"warn", "block"})


class AllocationStatus:
    ACTIVE     = "active"
    SUPERSEDED = "superseded"
    CANCELLED  = "cancelled"
    ALL: frozenset[str] = frozenset({"active", "superseded", "cancelled"})


class PoolStatus:
    OPEN      = "open"
    CLOSED    = "closed"
    CANCELLED = "cancelled"
    ALL: frozenset[str] = frozenset({"open", "closed", "cancelled"})


class AlertType:
    REPRICE_REQUIRED      = "reprice_required"
    ELIGIBILITY_LOST      = "eligibility_lost"
    BELOW_MARGIN_FLOOR    = "below_margin_floor"
    LOCK_EXPIRED          = "lock_expired"
    ALLOCATION_OVERRIDE   = "allocation_override"
    ALL: frozenset[str] = frozenset({
        "reprice_required", "eligibility_lost", "below_margin_floor",
        "lock_expired", "allocation_override",
    })


class AlertSeverity:
    INFO  = "info"
    WARN  = "warn"
    BLOCK = "block"
    ALL: frozenset[str] = frozenset({"info", "warn", "block"})


class AlertStatus:
    OPEN         = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED     = "resolved"
    DISMISSED    = "dismissed"
    ALL: frozenset[str] = frozenset({"open", "acknowledged", "resolved", "dismissed"})


# ── 2. Foundation: investors, programs, overlays (migration 135) ──────────────

class Investor(BaseModel):
    __tablename__ = "cm_investors"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','suspended','offboarded')",
            name="ck_cm_investors_status",
        ),
        UniqueConstraint("tenant_id", "name", name="uq_cm_investors_tenant_name"),
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=InvestorStatus.ACTIVE,
    )
    delivery_spec: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict,
    )

    programs: Mapped[list["InvestorProgram"]] = relationship(
        back_populates="investor", cascade="all, delete-orphan",
    )


class InvestorProgram(BaseModel):
    __tablename__ = "cm_investor_programs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','paused','retired')",
            name="ck_cm_investor_programs_status",
        ),
        UniqueConstraint(
            "tenant_id", "investor_id", "product_code", "guideline_version",
            name="uq_cm_investor_programs_version",
        ),
    )

    investor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_investors.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_code: Mapped[str] = mapped_column(String, nullable=False)
    guideline_version: Mapped[str] = mapped_column(String, nullable=False)
    overlay_version: Mapped[str] = mapped_column(String, nullable=False)
    srp_schedule: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict,
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=InvestorProgramStatus.ACTIVE,
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)

    investor: Mapped["Investor"] = relationship(back_populates="programs")


class InvestorOverlay(BaseModel):
    """Per ADR 5: overlay rows shadow base guidelines. tenant_id IS NULL
       means system default; tenant_id = X means tenant override."""
    __tablename__ = "cm_investor_overlays"
    __table_args__ = (
        CheckConstraint(
            "op IN ('<=','<','=','>','>=','in','not_in')",
            name="ck_cm_investor_overlays_op",
        ),
        CheckConstraint(
            "severity IN ('block','warn')",
            name="ck_cm_investor_overlays_severity",
        ),
    )

    tenant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=True,
    )
    investor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_investors.id", ondelete="CASCADE"),
        nullable=False,
    )
    program_version: Mapped[str] = mapped_column(String, nullable=False)
    rule_code: Mapped[str] = mapped_column(String, nullable=False)
    op: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    severity: Mapped[str] = mapped_column(
        String, nullable=False, server_default=OverlaySeverity.BLOCK,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)


# ── 3. Pricing artifact: rate sheets + LLPA grids (migration 135) ────────────

class RateSheet(BaseModel):
    __tablename__ = "cm_rate_sheets"
    __table_args__ = (
        CheckConstraint(
            "channel IN ('origina','broker','tpo')",
            name="ck_cm_rate_sheets_channel",
        ),
        CheckConstraint(
            "status IN ('draft','pending_approval','published','superseded','withdrawn')",
            name="ck_cm_rate_sheets_status",
        ),
        UniqueConstraint(
            "tenant_id", "channel", "version",
            name="uq_cm_rate_sheets_version",
        ),
    )

    channel: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=RateSheetStatus.DRAFT,
    )
    published_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_note: Mapped[str | None] = mapped_column(Text)
    supersedes_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_rate_sheets.id", ondelete="SET NULL"),
    )

    entries: Mapped[list["RateSheetEntry"]] = relationship(
        back_populates="rate_sheet", cascade="all, delete-orphan",
    )


class RateSheetEntry(AppendOnlyModel):
    """Immutable row of a published rate sheet — frozen with the sheet version.
       Per ADR 8 (Reproducibility as a CI-Enforced Invariant), the entry's
       tenant_id, product_code, lock_period_days, loan_amount band and rate/points
       are part of the persisted snapshot referenced by every priced decision."""
    __tablename__ = "cm_rate_sheet_entries"
    __table_args__ = (
        CheckConstraint("lock_period_days > 0", name="ck_cm_rate_sheet_entries_lock_period"),
        CheckConstraint("loan_amount_max >= loan_amount_min", name="ck_cm_rate_sheet_entries_band"),
    )

    rate_sheet_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_rate_sheets.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_code: Mapped[str] = mapped_column(String, nullable=False)
    lock_period_days: Mapped[int] = mapped_column(Integer, nullable=False)
    loan_amount_min: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    loan_amount_max: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    rate_bps: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    points: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False, default=0)

    rate_sheet: Mapped["RateSheet"] = relationship(back_populates="entries")


class LlpaGrid(BaseModel):
    __tablename__ = "cm_llpa_grids"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "grid_code", "version",
            name="uq_cm_llpa_grids_version",
        ),
    )

    grid_code: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    dimension_spec: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)

    cells: Mapped[list["LlpaCell"]] = relationship(
        back_populates="llpa_grid", cascade="all, delete-orphan",
    )


class LlpaCell(AppendOnlyModel):
    """Immutable grid cell — frozen with the LLPA grid version.
       Per ADR 8 (Reproducibility as a CI-Enforced Invariant), the cell's
       axis_values and value_bps are part of the persisted snapshot referenced
       by every priced decision."""
    __tablename__ = "cm_llpa_cells"

    llpa_grid_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_llpa_grids.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_code: Mapped[str] = mapped_column(String, nullable=False)
    axis_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    value_bps: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

    llpa_grid: Mapped["LlpaGrid"] = relationship(back_populates="cells")


# ── 4. Material-change registry (migration 135) ──────────────────────────────

class MaterialChangeRegistry(BaseModel):
    """Per ADR 4: versioned field→impact config. tenant_id IS NULL = system,
       tenant_id = X = tenant override. Reuses the controlled_values
       shadowing pattern (no new mechanism introduced)."""
    __tablename__ = "cm_material_change_registry"
    __table_args__ = (
        CheckConstraint(
            "impact IN ('rate','price','eligibility','best_ex_rank')",
            name="ck_cm_material_change_registry_impact",
        ),
        CheckConstraint(
            "severity IN ('warn','block')",
            name="ck_cm_material_change_registry_severity",
        ),
    )

    tenant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=True,
    )
    field_name: Mapped[str] = mapped_column(String, nullable=False)
    impact: Mapped[str] = mapped_column(String, nullable=False)
    tolerance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    severity: Mapped[str] = mapped_column(
        String, nullable=False, server_default=MaterialChangeSeverity.WARN,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)


# ── 5. Lock artifact + append-only event log (migration 136) ─────────────────

class Lock(BaseModel):
    """Per ADR 3: lock is a first-class artifact, not a loan status field.
       Core priced terms are immutable after confirm; lifecycle moves via
       LockEvent rows.
    """
    __tablename__ = "cm_locks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested','confirmed','reprice_required',"
            "'extended','expired','cancelled','funded_delivered')",
            name="ck_cm_locks_status",
        ),
        CheckConstraint("lock_period_days > 0", name="ck_cm_locks_lock_period"),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    rate_sheet_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_rate_sheets.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Reproduction fields (ADR 8)
    loan_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    snapshot_hash: Mapped[str] = mapped_column(String, nullable=False)
    snapshot_versions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict,
    )

    # Priced terms (immutable after confirm)
    rate_bps: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    llpa_adjustments: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list,
    )
    srp_bps: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False, default=0,
    )
    delivery_fee: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0,
    )
    adjusted_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    net_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    calc_version: Mapped[str] = mapped_column(String, nullable=False)

    # Lock terms
    lock_period_days: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    confirmed_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=LockStatus.REQUESTED,
    )
    reprice_required_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prior_lock_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_locks.id", ondelete="SET NULL"),
    )

    events: Mapped[list["LockEvent"]] = relationship(
        back_populates="lock", cascade="all, delete-orphan",
    )


class LockEvent(AppendOnlyModel):
    """Per ADR 3: append-only lifecycle log of state transitions on a lock.
       No updated_at by design — see AppendOnlyModel."""
    __tablename__ = "cm_lock_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('requested','confirmed','reprice_flagged','repriced',"
            "'extended','expired','cancelled','funded_delivered')",
            name="ck_cm_lock_events_event_type",
        ),
    )

    lock_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_locks.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    price_delta: Mapped[float | None] = mapped_column(Numeric(12, 2))
    cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    policy_version: Mapped[str | None] = mapped_column(String)
    approval_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    lock: Mapped["Lock"] = relationship(back_populates="events")


# ── 6. Eligibility + best-execution runs (migration 137) ──────────────────────

class EligibilityResult(AppendOnlyModel):
    """Per ADR 8: one row per (loan, program) evaluation. Re-evaluations
       produce new rows; the prior row is preserved for audit.
       Per ADR 5: rule_trace includes both base and overlay rule outcomes.
       Per ADR 7: this is the CMS-owned single source of truth — UI never
       re-derives eligibility."""
    __tablename__ = "cm_eligibility_results"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    investor_program_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_investor_programs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Reproduction fields (ADR 8)
    loan_snapshot_hash: Mapped[str] = mapped_column(String, nullable=False)
    snapshot_versions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict,
    )
    calc_version: Mapped[str] = mapped_column(String, nullable=False)

    # Outcome
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failing_rules: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list,
    )
    rule_trace: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list,
    )
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )


class BestExecutionRun(AppendOnlyModel):
    """Per ADR 8: full ranked exit table persisted for replay.
       ranked_results is the ordered best→worst list with per-investor
       breakdown. chosen_investor_program_id is the system pick;
       allocations may override (override_reason captured on the allocation).
       Per ADR 7: CMS-owned single source of truth."""
    __tablename__ = "cm_best_execution_runs"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Reproduction fields (ADR 8)
    loan_snapshot_hash: Mapped[str] = mapped_column(String, nullable=False)
    loan_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    rate_sheet_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_rate_sheets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    snapshot_versions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict,
    )
    calc_version: Mapped[str] = mapped_column(String, nullable=False)

    # Inputs summary (fast filtering without parsing loan_snapshot)
    product_code: Mapped[str] = mapped_column(String, nullable=False)
    lock_period_days: Mapped[int] = mapped_column(Integer, nullable=False)
    rate_bps: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

    # Full ranked table
    ranked_results: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)

    chosen_investor_program_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_investor_programs.id", ondelete="SET NULL"),
    )
    variance_to_second: Mapped[float | None] = mapped_column(Numeric(12, 2))
    rationale: Mapped[str | None] = mapped_column(Text)

    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )


# ── 7. Pools + allocations (migration 138) ───────────────────────────────────

class Pool(BaseModel):
    __tablename__ = "cm_pools"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','closed','cancelled')",
            name="ck_cm_pools_status",
        ),
        UniqueConstraint("tenant_id", "name", name="uq_cm_pools_tenant_name"),
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    target_close: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=PoolStatus.OPEN,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    loans: Mapped[list["PoolLoan"]] = relationship(
        back_populates="pool", cascade="all, delete-orphan",
    )


class PoolLoan(AppendOnlyModel):
    """Immutable pool-membership row — written once, never updated.
       Migration 138 named the timestamp column `added_at` (not created_at) to
       disambiguate the membership time from the pool's own creation time.
       We shadow AppendOnlyModel.created_at with a column keyed under the
       physical column name `added_at` so SELECTs don't blow up."""
    __tablename__ = "cm_pool_loans"
    __table_args__ = (
        UniqueConstraint("pool_id", "loan_id", name="uq_cm_pool_loans_membership"),
    )

    # Override the inherited `created_at` column to bind to the physical
    # `added_at` column. SQLAlchemy allows re-declaring mapped_column on a
    # subclass to replace the inherited one. Same semantics: NOT NULL,
    # default now(); only the physical column name differs.
    created_at: Mapped[datetime] = mapped_column(
        "added_at", DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    pool_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_pools.id", ondelete="CASCADE"),
        nullable=False,
    )
    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    added_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    pool: Mapped["Pool"] = relationship(back_populates="loans")


class Allocation(AppendOnlyModel):
    """Per PoC §14.3 #5: immutable record at the application layer.
       best_execution_run_id is the source-of-truth FK that makes the
       audit chain reconstructable (§14.3 #6).
       Per PIN 2 (Milestone 1): the approver≠requester authority check
       is enforced in service code for the PoC — no second role exists."""
    __tablename__ = "cm_allocations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','superseded','cancelled')",
            name="ck_cm_allocations_status",
        ),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    pool_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_pools.id", ondelete="SET NULL"),
    )
    best_execution_run_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_best_execution_runs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    investor_program_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_investor_programs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=AllocationStatus.ACTIVE,
    )
    prior_allocation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cm_allocations.id", ondelete="SET NULL"),
    )
    override_reason: Mapped[str | None] = mapped_column(Text)
    override_actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    notes: Mapped[str | None] = mapped_column(Text)
    allocated_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    allocated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )


# ── 8. Alerts + audit-version config (migration 139) ─────────────────────────

class Alert(BaseModel):
    """Per PoC §14.1: notification fan-out is in-app list only for the PoC.
       Raised by material-change watcher, eligibility evaluator, margin-
       floor check, etc. Consumers (email/SMS) are out of scope here —
       the domain_events outbox + dispatcher from Sprint 4 is the future
       fan-out seam."""
    __tablename__ = "cm_alerts"
    __table_args__ = (
        CheckConstraint(
            "alert_type IN ('reprice_required','eligibility_lost','below_margin_floor',"
            "'lock_expired','allocation_override')",
            name="ck_cm_alerts_alert_type",
        ),
        CheckConstraint(
            "severity IN ('info','warn','block')",
            name="ck_cm_alerts_severity",
        ),
        CheckConstraint(
            "status IN ('open','acknowledged','resolved','dismissed')",
            name="ck_cm_alerts_status",
        ),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    alert_type: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(
        String, nullable=False, server_default=AlertStatus.OPEN,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_entity_type: Mapped[str | None] = mapped_column(String)
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    raised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    raised_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    acknowledged_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class AuditVersion(BaseModel):
    """Per ADR 8: human-readable companion to per-decision snapshot_versions.
       Auditors can see "as of date X, the system was operating under
       rate_sheet version 3, LLPA FICO×LTV grid version 2, ..."."""
    __tablename__ = "cm_audit_versions"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "config_code", "version",
            name="uq_cm_audit_versions_code_version",
        ),
    )

    config_code: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
