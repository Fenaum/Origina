from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EscrowDetailBase(BaseModel):
    company_name: Optional[str] = None
    officer_name: Optional[str] = None
    officer_email: Optional[str] = None
    officer_phone: Optional[str] = None
    company_address: Optional[str] = None
    escrow_number: Optional[str] = None
    contract_date: Optional[date] = None
    closing_date: Optional[date] = None
    settlement_agent: Optional[str] = None
    earnest_money_deposit: Optional[Decimal] = None
    wire_instructions_status: Optional[str] = None
    estimated_cash_to_close: Optional[Decimal] = None
    verified_cash_to_close: Optional[Decimal] = None
    seller_credits: Optional[Decimal] = None
    lender_credits: Optional[Decimal] = None
    third_party_fees: Optional[Decimal] = None
    escrow_balance: Optional[Decimal] = None
    closing_protection_letter: Optional[bool] = None
    settlement_stmt_reviewed: Optional[bool] = None
    wire_verified: Optional[bool] = None
    notes: Optional[str] = None


class EscrowDetailCreate(EscrowDetailBase):
    loan_id: UUID


class EscrowDetailUpdate(EscrowDetailBase):
    pass


class EscrowDetailOut(EscrowDetailBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    tenant_id: UUID
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
