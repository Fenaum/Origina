# Loan Model

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field #Importing BaseModel and Field from pydantic for data validation and model definition. BaseModel is the base class for creating data models, and Field is used to provide additional metadata and validation rules for model fields.


class LoanBase(BaseModel):
    # Core figures
    tenant_id: Optional[UUID] = None
    loan_number: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
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
    credit_score: Optional[int] = None
    principal_and_interest: Optional[Decimal] = None
    current_balance: Optional[Decimal] = None
    escrow_amount: Optional[Decimal] = None
    total_monthly_payment: Optional[Decimal] = None
    property_taxes: Optional[Decimal] = None
    homeowners_insurance: Optional[Decimal] = None
    hoa_fees: Optional[Decimal] = None
    other_expenses: Optional[Decimal] = None

    # Key dates
    submitted_at: Optional[date] = None
    application_date: Optional[date] = None
    closing_date: Optional[date] = None
    funding_date: Optional[date] = None
    disbursement_date: Optional[date] = None
    initial_disclosure_date: Optional[date] = None
    closing_disclosure_date: Optional[date] = None
    closing_redisclosure_date: Optional[date] = None
    rate_lock: Optional[date] = None
    lock_expiration_date: Optional[date] = None
    le_redisclosure_date: Optional[date] = None

    # Loan details
    interest_rate_locked: Optional[bool] = None
    rate_lock_date: Optional[date] = None
    rate_lock_days: Optional[int] = None
    initial_rate: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    term_months: Optional[int] = None
    amortization_type: Optional[str] = None
    prepayment_penalty: Optional[bool] = None
    occupancy_type: Optional[str] = None
    loan_program: Optional[str] = None
    loan_product: Optional[str] = None
    purpose_detail: Optional[str] = None
    rate_type: Optional[str] = None
    payment_type: Optional[str] = None
    purpose: Optional[str] = None
    cashout_type: Optional[str] = None
    property_use: Optional[str] = None
    construction_type: Optional[str] = None

    # Flexible product fields: These fields allow for dynamic storage of additional product-specific data without needing to modify the schema for every new product. This design provides flexibility to accommodate various loan products with different attributes.
    product_data: Dict[str, Any] = Field(default_factory=dict)


class LoanCreate(LoanBase):
    tenant_id: UUID


class LoanUpdate(LoanBase):
    pass


class LoanOut(LoanBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
