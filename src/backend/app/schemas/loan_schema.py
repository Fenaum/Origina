from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
    tenant_id: UUID


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
