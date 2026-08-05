"""Pydantic schemas for the Capital Markets (CM) PoC.

Mirrors the ORM models in app/models/capital_markets.py. Per CLAUDE.md:
  • Pattern: <Domain>Base → <Domain>Create / <Domain>Update → <Domain>Out.
  • Out shapes use ConfigDict(from_attributes=True) for ORM compatibility.
  • tenant_id is NEVER accepted from request bodies — always derived from
    the authenticated user's JWT (the routes in Milestone 2 will enforce this).

This file is read-only infrastructure for Milestone 1 (data foundation + seed).
Routes land in Milestone 2.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── 1. cm_investors ───────────────────────────────────────────────────────────

class InvestorBase(BaseModel):
    name: str
    contact_email: Optional[str] = None
    status: Optional[str] = "active"
    delivery_spec: dict[str, Any] = Field(default_factory=dict)


class InvestorCreate(InvestorBase):
    pass


class InvestorUpdate(BaseModel):
    contact_email: Optional[str] = None
    status: Optional[str] = None
    delivery_spec: Optional[dict[str, Any]] = None


class InvestorOut(InvestorBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


# ── 2. cm_investor_programs ───────────────────────────────────────────────────

class InvestorProgramBase(BaseModel):
    investor_id: UUID
    product_code: str
    guideline_version: str
    overlay_version: str
    srp_schedule: dict[str, Any] = Field(default_factory=dict)
    status: Optional[str] = "active"
    effective_from: date
    effective_to: Optional[date] = None


class InvestorProgramCreate(InvestorProgramBase):
    pass


class InvestorProgramUpdate(BaseModel):
    srp_schedule: Optional[dict[str, Any]] = None
    status: Optional[str] = None
    effective_to: Optional[date] = None


class InvestorProgramOut(InvestorProgramBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


# ── 3. cm_investor_overlays ───────────────────────────────────────────────────

class InvestorOverlayBase(BaseModel):
    investor_id: UUID
    program_version: str
    rule_code: str
    op: str
    value: Any
    severity: Optional[str] = "block"
    sort_order: Optional[int] = 0
    effective_from: date
    effective_to: Optional[date] = None


class InvestorOverlayCreate(InvestorOverlayBase):
    pass


class InvestorOverlayUpdate(BaseModel):
    value: Optional[Any] = None
    severity: Optional[str] = None
    sort_order: Optional[int] = None
    effective_to: Optional[date] = None


class InvestorOverlayOut(InvestorOverlayBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: Optional[UUID] = None           # nullable for system defaults
    created_at: datetime
    updated_at: datetime


# ── 4. cm_rate_sheets ─────────────────────────────────────────────────────────

class RateSheetBase(BaseModel):
    channel: str
    version: int
    effective_from: date
    effective_to: Optional[date] = None
    status: Optional[str] = "draft"
    source_note: Optional[str] = None
    supersedes_id: Optional[UUID] = None


class RateSheetCreate(RateSheetBase):
    pass


class RateSheetUpdate(BaseModel):
    status: Optional[str] = None
    effective_to: Optional[date] = None
    source_note: Optional[str] = None


class RateSheetOut(RateSheetBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    published_by: Optional[UUID] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class RateSheetEntryBase(BaseModel):
    product_code: str
    lock_period_days: int
    loan_amount_min: float
    loan_amount_max: float
    rate_bps: float
    points: Optional[float] = 0


class RateSheetEntryCreate(RateSheetEntryBase):
    rate_sheet_id: UUID


class RateSheetEntryOut(RateSheetEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    rate_sheet_id: UUID
    created_at: datetime


# ── 5. cm_llpa_grids + cm_llpa_cells ──────────────────────────────────────────

class LlpaGridBase(BaseModel):
    grid_code: str
    version: int
    dimension_spec: dict[str, Any]
    effective_from: date
    effective_to: Optional[date] = None


class LlpaGridCreate(LlpaGridBase):
    pass


class LlpaGridUpdate(BaseModel):
    effective_to: Optional[date] = None


class LlpaGridOut(LlpaGridBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


class LlpaCellBase(BaseModel):
    product_code: str
    axis_values: dict[str, Any]
    value_bps: float


class LlpaCellCreate(LlpaCellBase):
    llpa_grid_id: UUID


class LlpaCellOut(LlpaCellBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    llpa_grid_id: UUID
    created_at: datetime


# ── 6. cm_material_change_registry ────────────────────────────────────────────

class MaterialChangeRegistryBase(BaseModel):
    field_name: str
    impact: str
    tolerance: dict[str, Any]
    severity: Optional[str] = "warn"
    version: int
    effective_from: date
    effective_to: Optional[date] = None


class MaterialChangeRegistryCreate(MaterialChangeRegistryBase):
    pass


class MaterialChangeRegistryUpdate(BaseModel):
    tolerance: Optional[dict[str, Any]] = None
    severity: Optional[str] = None
    effective_to: Optional[date] = None


class MaterialChangeRegistryOut(MaterialChangeRegistryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ── 7. cm_locks ───────────────────────────────────────────────────────────────

class LockBase(BaseModel):
    loan_id: UUID
    rate_sheet_id: UUID
    loan_snapshot: dict[str, Any]
    snapshot_hash: str
    snapshot_versions: dict[str, Any] = Field(default_factory=dict)
    rate_bps: float
    base_price: float
    llpa_adjustments: list[dict[str, Any]] = Field(default_factory=list)
    srp_bps: Optional[float] = 0
    delivery_fee: Optional[float] = 0
    adjusted_price: float
    net_price: float
    calc_version: str
    lock_period_days: int


class LockCreate(LockBase):
    requested_by: UUID


class LockConfirm(BaseModel):
    confirmed_by: UUID


class LockExpire(BaseModel):
    pass


class LockReprice(BaseModel):
    reason: str
    actor_user_id: UUID


class LockOut(LockBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    requested_at: datetime
    confirmed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    requested_by: UUID
    confirmed_by: Optional[UUID] = None
    status: str
    reprice_required_at: Optional[datetime] = None
    prior_lock_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class LockEventBase(BaseModel):
    event_type: str
    price_delta: Optional[float] = None
    cost: Optional[float] = None
    policy_version: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class LockEventCreate(LockEventBase):
    lock_id: UUID
    actor_user_id: Optional[UUID] = None


class LockEventOut(LockEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    lock_id: UUID
    actor_user_id: Optional[UUID] = None
    created_at: datetime


# ── 8. cm_eligibility_results ─────────────────────────────────────────────────

class EligibilityResultBase(BaseModel):
    loan_id: UUID
    investor_program_id: UUID
    loan_snapshot_hash: str
    snapshot_versions: dict[str, Any] = Field(default_factory=dict)
    calc_version: str
    passed: bool
    failing_rules: list[dict[str, Any]] = Field(default_factory=list)
    rule_trace: list[dict[str, Any]] = Field(default_factory=list)


class EligibilityResultCreate(EligibilityResultBase):
    pass


class EligibilityResultOut(EligibilityResultBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    evaluated_at: datetime
    created_at: datetime


# ── 9. cm_best_execution_runs ─────────────────────────────────────────────────

class BestExecutionRunBase(BaseModel):
    loan_id: UUID
    loan_snapshot_hash: str
    loan_snapshot: dict[str, Any]
    rate_sheet_id: UUID
    snapshot_versions: dict[str, Any] = Field(default_factory=dict)
    calc_version: str
    product_code: str
    lock_period_days: int
    rate_bps: float
    ranked_results: list[dict[str, Any]]
    chosen_investor_program_id: Optional[UUID] = None
    variance_to_second: Optional[float] = None
    rationale: Optional[str] = None


class BestExecutionRunCreate(BestExecutionRunBase):
    pass


class BestExecutionRunOut(BestExecutionRunBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    evaluated_at: datetime
    created_at: datetime


# ── 10. cm_pools + cm_allocations ─────────────────────────────────────────────

class PoolBase(BaseModel):
    name: str
    target_close: Optional[date] = None
    status: Optional[str] = "open"
    notes: Optional[str] = None


class PoolCreate(PoolBase):
    created_by: UUID


class PoolUpdate(BaseModel):
    target_close: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PoolOut(PoolBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class PoolLoanCreate(BaseModel):
    pool_id: UUID
    loan_id: UUID
    added_by: UUID


class PoolLoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    pool_id: UUID
    loan_id: UUID
    added_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class AllocationBase(BaseModel):
    loan_id: UUID
    pool_id: Optional[UUID] = None
    best_execution_run_id: UUID
    investor_program_id: UUID
    override_reason: Optional[str] = None
    override_actor_user_id: Optional[UUID] = None
    notes: Optional[str] = None


class AllocationCreate(AllocationBase):
    allocated_by: UUID


class AllocationOut(AllocationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    status: str
    prior_allocation_id: Optional[UUID] = None
    allocated_by: UUID
    allocated_at: datetime
    created_at: datetime


# ── 11. cm_alerts ─────────────────────────────────────────────────────────────

class AlertBase(BaseModel):
    loan_id: UUID
    alert_type: str
    severity: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class AlertCreate(AlertBase):
    raised_by_user_id: Optional[UUID] = None


class AlertAcknowledge(BaseModel):
    acknowledged_by: UUID


class AlertResolve(BaseModel):
    resolved_by: UUID


class AlertOut(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    status: str
    raised_at: datetime
    raised_by_user_id: Optional[UUID] = None
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── 12. cm_audit_versions ─────────────────────────────────────────────────────

class AuditVersionBase(BaseModel):
    config_code: str
    version: int
    effective_to: Optional[datetime] = None
    notes: Optional[str] = None


class AuditVersionCreate(AuditVersionBase):
    created_by: Optional[UUID] = None


class AuditVersionUpdate(BaseModel):
    effective_to: Optional[datetime] = None
    notes: Optional[str] = None


class AuditVersionOut(AuditVersionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    effective_from: datetime
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
