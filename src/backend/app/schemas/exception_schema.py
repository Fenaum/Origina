from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

# ── Controlled value sets ─────────────────────────────────────────────────────
# Single source of truth for all categorical fields. Mirrors the CHECK
# constraints in migrations 119 and 120. Import these in service-layer code
# that needs to validate values programmatically.

EXCEPTION_PRIMARY_CATEGORIES = frozenset({
    "credit",
    "collateral",
    "income",
    "assets_reserves",
    "pricing",
    "product_guideline",
    "broker_account",
    "documentation",
    "compliance",
    "other",
})

EXCEPTION_TYPES = frozenset({
    "ltv",
    "cltv",
    "credit_score",
    "dscr",
    "dti",
    "reserves",
    "price_match",
    "rate",
    "fee",
    "loan_amount",
    "occupancy",
    "property_type",
    "seasoning",
    "documentation",
    "broker_approval",
    "income_type",
    "employment",
    "other",
})

EXCEPTION_REASON_CODES = frozenset({
    "strong_borrower_profile",
    "minor_guideline_variance",
    "competitive_price_match",
    "investor_relationship",
    "strategic_broker_relationship",
    "operational_exception",
    "prior_approval_precedent",
    "compensating_risk_profile",
    "other",
})

EXCEPTION_CONTEXT_TYPES = frozenset({
    "pre_file",
    "pricing_scenario",
    "broker_account",
    "loan_file",
})

EXCEPTION_METRIC_TYPES = frozenset({
    "ltv", "cltv", "fico", "dti", "dscr",
    "rate", "months", "loan_amount", "other",
})

EXCEPTION_GUIDELINE_OPERATORS = frozenset({"<=", ">=", "<", ">", "="})

EXCEPTION_VARIANCE_UNITS = frozenset({
    "pct", "bps", "months", "dollars", "points",
})

COMPENSATING_FACTOR_CODES = frozenset({
    "high_fico",
    "strong_reserves",
    "low_ltv",
    "low_dti",
    "strong_dscr",
    "stable_employment",
    "strong_payment_history",
    "significant_liquidity",
    "strong_property_value",
    "borrower_experience",
    "low_layered_risk",
    "other",
})

RISK_FACTOR_CODES = frozenset({
    "high_ltv",
    "low_fico",
    "high_dti",
    "low_dscr",
    "cash_out",
    "investment_property",
    "limited_reserves",
    "recent_credit_event",
    "thin_credit_profile",
    "concentration_risk",
    "incomplete_documentation",
    "pricing_concession",
    "other",
})

EXCEPTION_STATUSES_ALL = frozenset({
    "open", "draft", "submitted", "assigned", "under_review",
    "additional_info_requested", "approved", "approved_with_conditions",
    "denied", "withdrawn", "closed",
})

EXCEPTION_SEVERITIES_ALL = frozenset({"low", "medium", "high", "critical"})


# ── Factor model ──────────────────────────────────────────────────────────────

class ExceptionFactor(BaseModel):
    """A single structured compensating or risk factor selection."""
    code: str
    notes: Optional[str] = None

    @field_validator("code")
    @classmethod
    def _code_must_be_known(cls, v: str) -> str:
        # Accept both compensating and risk factor codes in a single model.
        valid = COMPENSATING_FACTOR_CODES | RISK_FACTOR_CODES
        if v not in valid:
            raise ValueError(
                f"Unknown factor code '{v}'. Must be one of: {sorted(valid)}"
            )
        return v


# ── Exception ─────────────────────────────────────────────────────────────────

class ExceptionBase(BaseModel):
    exception_type: str
    title: str
    description: Optional[str] = None
    severity: Optional[str] = "medium"

    # Classification
    primary_category: Optional[str] = "other"
    reason_code: Optional[str] = "other"
    related_categories: Optional[list[str]] = None
    context_type: Optional[str] = "loan_file"

    # Display text fields (kept for human-readable rendering)
    guideline_value: Optional[str] = None
    actual_value: Optional[str] = None
    variance: Optional[str] = None
    justification: Optional[str] = None

    # Structured numeric metrics
    metric_type: Optional[str] = None
    guideline_operator: Optional[str] = None
    metric_guideline: Optional[Decimal] = None
    metric_actual: Optional[Decimal] = None
    metric_variance: Optional[Decimal] = None
    metric_variance_unit: Optional[str] = None

    # Structured factors
    compensating_factors: Optional[list[ExceptionFactor]] = None
    risk_factors: Optional[list[ExceptionFactor]] = None

    @field_validator("exception_type")
    @classmethod
    def _validate_exception_type(cls, v: str) -> str:
        if v not in EXCEPTION_TYPES:
            raise ValueError(
                f"Unknown exception_type '{v}'. Must be one of: {sorted(EXCEPTION_TYPES)}"
            )
        return v

    @field_validator("severity")
    @classmethod
    def _validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_SEVERITIES_ALL:
            raise ValueError(f"severity must be one of: {sorted(EXCEPTION_SEVERITIES_ALL)}")
        return v

    @field_validator("primary_category")
    @classmethod
    def _validate_primary_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_PRIMARY_CATEGORIES:
            raise ValueError(
                f"primary_category must be one of: {sorted(EXCEPTION_PRIMARY_CATEGORIES)}"
            )
        return v

    @field_validator("reason_code")
    @classmethod
    def _validate_reason_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_REASON_CODES:
            raise ValueError(
                f"reason_code must be one of: {sorted(EXCEPTION_REASON_CODES)}"
            )
        return v

    @field_validator("context_type")
    @classmethod
    def _validate_context_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_CONTEXT_TYPES:
            raise ValueError(
                f"context_type must be one of: {sorted(EXCEPTION_CONTEXT_TYPES)}"
            )
        return v

    @field_validator("related_categories")
    @classmethod
    def _validate_related_categories(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None:
            bad = [x for x in v if x not in EXCEPTION_PRIMARY_CATEGORIES]
            if bad:
                raise ValueError(
                    f"related_categories contains invalid values: {bad}. "
                    f"Must all be in: {sorted(EXCEPTION_PRIMARY_CATEGORIES)}"
                )
        return v

    @field_validator("metric_type")
    @classmethod
    def _validate_metric_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_METRIC_TYPES:
            raise ValueError(
                f"metric_type must be one of: {sorted(EXCEPTION_METRIC_TYPES)}"
            )
        return v

    @field_validator("guideline_operator")
    @classmethod
    def _validate_guideline_operator(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_GUIDELINE_OPERATORS:
            raise ValueError(
                f"guideline_operator must be one of: {sorted(EXCEPTION_GUIDELINE_OPERATORS)}"
            )
        return v

    @field_validator("metric_variance_unit")
    @classmethod
    def _validate_variance_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_VARIANCE_UNITS:
            raise ValueError(
                f"metric_variance_unit must be one of: {sorted(EXCEPTION_VARIANCE_UNITS)}"
            )
        return v


class ExceptionCreate(ExceptionBase):
    loan_id: Optional[UUID] = None
    # exception_source kept for backward compat; context_type is preferred
    exception_source: Optional[str] = "loan_file"
    # loan_snapshot is NOT accepted from the request body — it is generated
    # automatically by the service layer from live loan data at creation time.


class ExceptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    primary_category: Optional[str] = None
    reason_code: Optional[str] = None
    related_categories: Optional[list[str]] = None
    guideline_value: Optional[str] = None
    actual_value: Optional[str] = None
    variance: Optional[str] = None
    justification: Optional[str] = None
    metric_type: Optional[str] = None
    guideline_operator: Optional[str] = None
    metric_guideline: Optional[Decimal] = None
    metric_actual: Optional[Decimal] = None
    metric_variance: Optional[Decimal] = None
    metric_variance_unit: Optional[str] = None
    compensating_factors: Optional[list[ExceptionFactor]] = None
    risk_factors: Optional[list[ExceptionFactor]] = None

    @field_validator("severity")
    @classmethod
    def _validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_SEVERITIES_ALL:
            raise ValueError(f"severity must be one of: {sorted(EXCEPTION_SEVERITIES_ALL)}")
        return v

    @field_validator("primary_category")
    @classmethod
    def _validate_primary_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_PRIMARY_CATEGORIES:
            raise ValueError(
                f"primary_category must be one of: {sorted(EXCEPTION_PRIMARY_CATEGORIES)}"
            )
        return v

    @field_validator("reason_code")
    @classmethod
    def _validate_reason_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in EXCEPTION_REASON_CODES:
            raise ValueError(
                f"reason_code must be one of: {sorted(EXCEPTION_REASON_CODES)}"
            )
        return v


class ExceptionOut(ExceptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    loan_id: Optional[UUID] = None
    exception_source: str
    context_type: str
    primary_category: str
    reason_code: str
    related_categories: list[str]
    status: str
    loan_snapshot: dict[str, Any]
    loan_snapshot_hash: Optional[str] = None
    assigned_to: Optional[UUID] = None
    submitted_at: Optional[datetime] = None
    # Override base class optionals — always present on read
    compensating_factors: list[ExceptionFactor]
    risk_factors: list[ExceptionFactor]
    requested_by: Optional[UUID] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Workflow action schemas ────────────────────────────────────────────────────

class ExceptionSubmitRequest(BaseModel):
    """Body for POST /{id}/submit. No fields required — submitting has no payload."""
    pass


class ExceptionAssignRequest(BaseModel):
    assigned_to: UUID


# ── Decision actions ──────────────────────────────────────────────────────────

class DecisionRequest(BaseModel):
    reason: Optional[str] = None


# ── Exception events ──────────────────────────────────────────────────────────

class ExceptionEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    event_type: str
    actor_user_id: Optional[UUID] = None
    event_data: dict[str, Any]
    occurred_at: datetime


# ── Exception comments ────────────────────────────────────────────────────────

class ExceptionCommentCreate(BaseModel):
    body: str
    is_internal: Optional[bool] = False


class ExceptionCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    body: str
    created_by: Optional[UUID] = None
    is_internal: bool
    created_at: datetime


# ── Exception documents ───────────────────────────────────────────────────────

class ExceptionDocumentCreate(BaseModel):
    document_id: UUID


class ExceptionDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_id: UUID
    document_id: UUID
    attached_by: Optional[UUID] = None
    attached_at: datetime


# ── Authority rules ───────────────────────────────────────────────────────────

class ExceptionAuthorityRuleCreate(BaseModel):
    exception_type: Optional[str] = None
    max_severity: Optional[str] = "critical"
    allowed_roles: Optional[list[str]] = None
    requires_dual_approval: Optional[bool] = False

    @field_validator("allowed_roles")
    @classmethod
    def _validate_roles(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        known = {"loan_officer", "loan_processor", "underwriter", "account_manager", "it_admin"}
        if v is not None:
            bad = [r for r in v if r not in known]
            if bad:
                raise ValueError(f"Unknown roles: {bad}. Must be in: {sorted(known)}")
        return v


class ExceptionAuthorityRuleUpdate(BaseModel):
    exception_type: Optional[str] = None
    max_severity: Optional[str] = None
    allowed_roles: Optional[list[str]] = None
    requires_dual_approval: Optional[bool] = None
    is_active: Optional[bool] = None


class ExceptionAuthorityRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    exception_type: Optional[str] = None
    max_severity: str
    allowed_roles: list[str]
    requires_dual_approval: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
