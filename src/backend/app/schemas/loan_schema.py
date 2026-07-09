from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# PaginatedResponse was lifted to schemas/common_schema.py in Sprint 2 —
# re-exported here for backward compatibility with anything that does
# `from app.schemas.loan_schema import PaginatedResponse`.
from app.schemas.common_schema import PaginatedResponse



# ── LoanFinancials ─────────────────────────────────────────────────────────────

class LoanFinancialsBase(BaseModel):
    loan_amount: Optional[Decimal] = None
    purchase_price: Optional[Decimal] = None
    appraised_value: Optional[Decimal] = None
    down_payment: Optional[Decimal] = None
    ltv: Optional[Decimal] = None
    cltv: Optional[Decimal] = None
    fico_score: Optional[int] = None
    debt_to_income: Optional[Decimal] = None
    dscr: Optional[Decimal] = None
    cash_reserves: Optional[Decimal] = None
    monthly_rent: Optional[Decimal] = None
    monthly_income: Optional[Decimal] = None
    monthly_debt: Optional[Decimal] = None
    other_income: Optional[Decimal] = None
    other_debt: Optional[Decimal] = None
    principal_and_interest: Optional[Decimal] = None
    current_balance: Optional[Decimal] = None
    escrow_amount: Optional[Decimal] = None
    total_monthly_payment: Optional[Decimal] = None
    property_taxes: Optional[Decimal] = None
    homeowners_insurance: Optional[Decimal] = None
    hoa_fees: Optional[Decimal] = None
    other_expenses: Optional[Decimal] = None


class LoanFinancialsCreate(LoanFinancialsBase):
    loan_id: UUID
    tenant_id: UUID


class LoanFinancialsUpdate(LoanFinancialsBase):
    pass


class LoanFinancialsOut(LoanFinancialsBase):
    model_config = ConfigDict(from_attributes=True)

    loan_id: UUID
    created_at: datetime
    updated_at: datetime


# ── LoanTerms ──────────────────────────────────────────────────────────────────

class LoanTermsBase(BaseModel):
    interest_rate_locked: Optional[bool] = None
    rate_lock_date: Optional[date] = None
    rate_lock_days: Optional[int] = None
    lock_expiration_date: Optional[date] = None
    initial_rate: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    term_months: Optional[int] = None
    amortization_type: Optional[str] = None
    prepayment_penalty: Optional[bool] = None
    rate_type: Optional[str] = None
    payment_type: Optional[str] = None


class LoanTermsCreate(LoanTermsBase):
    loan_id: UUID
    tenant_id: UUID


class LoanTermsUpdate(LoanTermsBase):
    pass


class LoanTermsOut(LoanTermsBase):
    model_config = ConfigDict(from_attributes=True)

    loan_id: UUID
    created_at: datetime
    updated_at: datetime


# ── Loan ───────────────────────────────────────────────────────────────────────

class LoanBase(BaseModel):
    loan_number: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None

    # Lifecycle dates
    submitted_at: Optional[date] = None
    application_date: Optional[date] = None
    closing_date: Optional[date] = None
    funding_date: Optional[date] = None
    disbursement_date: Optional[date] = None
    initial_disclosure_date: Optional[date] = None
    closing_disclosure_date: Optional[date] = None
    closing_redisclosure_date: Optional[date] = None
    le_redisclosure_date: Optional[date] = None

    # Loan descriptor
    purpose: Optional[str] = None
    occupancy_type: Optional[str] = None
    loan_program: Optional[str] = None
    loan_product: Optional[str] = None
    purpose_detail: Optional[str] = None
    cashout_type: Optional[str] = None
    property_use: Optional[str] = None
    construction_type: Optional[str] = None

    product_data: Dict[str, Any] = Field(default_factory=dict)


class LoanCreate(LoanBase):
    # tenant_id is intentionally absent — the endpoint injects it from the
    # authenticated user's JWT. Clients must not send it.
    pass


class LoanUpdate(LoanBase):
    pass


class LoanOut(LoanBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    # Satellite tables — None when not yet created or not eager-loaded
    financials: Optional[LoanFinancialsOut] = None
    terms: Optional[LoanTermsOut] = None


# ── LoanParty ──────────────────────────────────────────────────────────────────

class LoanPartyBase(BaseModel):
    party_id: UUID
    role: str
    is_primary: bool = False


class LoanPartyCreate(LoanPartyBase):
    tenant_id: UUID
    loan_id: UUID


class LoanPartyOut(LoanPartyBase):
    model_config = ConfigDict(from_attributes=True)

    tenant_id: UUID
    loan_id: UUID
    created_at: datetime


# ── LoanPipelineSummary ────────────────────────────────────────────────────────

class LoanPipelineSummaryOut(BaseModel):
    """Flat summary row for the pipeline view — one query per page, no N+1."""

    id: UUID
    loan_number: Optional[str]
    status: str
    loan_program: Optional[str]
    submitted_at: Optional[date]
    updated_at: datetime
    loan_amount: Optional[Decimal]
    borrower_name: str
    property_state: Optional[str]
    conditions_open: int
    conditions_submitted: int
    actions_needed: int


# ── Context Menu / Quick Actions ───────────────────────────────────────────────

class LoanQuickInfoOut(BaseModel):
    """Compact loan summary for the pipeline quick-info popover."""

    id: UUID
    loan_number: Optional[str]
    status: str
    loan_program: Optional[str]
    purpose: Optional[str]
    loan_amount: Optional[Decimal]
    borrower_name: str
    property_state: Optional[str]
    submitted_at: Optional[datetime]
    updated_at: datetime
    # From loan_financials
    ltv: Optional[Decimal]
    cltv: Optional[Decimal]
    fico_score: Optional[int]
    debt_to_income: Optional[Decimal]
    dscr: Optional[Decimal]


class ActivityEventOut(BaseModel):
    """A single item in the loan activity feed."""
    id: str
    event_type: str  # "note" | "status_change" | "condition_change" | "document_upload"
    occurred_at: datetime
    actor_name: Optional[str] = None
    detail: str
    body: Optional[str] = None


class LoanNoteCreate(BaseModel):
    body: str


class SandboxOut(BaseModel):
    """Placeholder response for the Open in Sandbox action. Not yet provisioned."""

    sandbox_id: str
    url: str
    message: str


class MoveTenantRequest(BaseModel):
    target_tenant_id: UUID
    reason: Optional[str] = None


class ArchiveLoanRequest(BaseModel):
    reason: Optional[str] = None


class LoanSubmitOut(BaseModel):
    """Response from POST /loans/{id}/submit."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_number: Optional[str]
    status: str
    submitted_at: Optional[date]
    updated_at: datetime
    borrower_name: Optional[str] = None
    loan_amount: Optional[Decimal] = None
    loan_program: Optional[str] = None
