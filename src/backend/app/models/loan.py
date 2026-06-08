from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TenantMixin, TimestampMixin


class LoanStatus(str, Enum):
    NEW_DRAFT = "new_draft"
    SUBMITTED = "submitted"
    CONDITIONS_REVIEW = "conditions_review"
    APPROVED_PENDING = "approved_pending"
    APPROVED = "approved"
    DENIED = "denied"
    CLOSED = "closed"
    FUNDED = "funded"
    POST_CLOSING = "post_closing"
    ARCHIVED = "archived"
    WITHDRAWN = "withdrawn"
    CANCELLED = "cancelled"


class LoanPurpose(str, Enum):
    PURCHASE = "purchase"
    REFINANCE = "refinance"
    CASH_OUT = "cash_out"
    OTHER = "other"


class LoanPartyRole(str, Enum):
    BORROWER = "borrower"
    CO_BORROWER = "co_borrower"
    BROKER = "broker"
    SELLER = "seller"
    REALTOR = "realtor"
    LOAN_OFFICER = "loan_officer"
    PROCESSOR = "processor"
    UNDERWRITER = "underwriter"
    OTHER = "other"


# WHY _ENUM_KWARGS pattern:
#   create_type=False tells SQLAlchemy "this ENUM type already exists in the
#   database — do not try to CREATE it." Without this flag, SQLAlchemy would
#   attempt to CREATE TYPE loan_status ... when create_all() or Alembic runs,
#   and fail with "type already exists" because 030_types.sql already defined
#   it. Every ENUM column that references a type from 030_types.sql needs this.
_LOAN_STATUS_COL = dict(
    name="loan_status",
    values_callable=lambda e: [v.value for v in e],
    create_type=False,
)
_LOAN_PURPOSE_COL = dict(
    name="loan_purpose",
    values_callable=lambda e: [v.value for v in e],
    create_type=False,
)
_LOAN_PARTY_ROLE_COL = dict(
    name="loan_party_role",
    values_callable=lambda e: [v.value for v in e],
    create_type=False,
)


class Loan(BaseModel):
    __tablename__ = "loans"

    loan_number: Mapped[str | None] = mapped_column(String)
    status: Mapped[LoanStatus] = mapped_column(
        ENUM(LoanStatus, **_LOAN_STATUS_COL),
        nullable=False,
        server_default=LoanStatus.NEW_DRAFT.value,
    )
    assigned_to: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    # ── Key dates (lifecycle and regulatory disclosure dates) ──────────────────
    submitted_at: Mapped[date | None] = mapped_column(Date)
    application_date: Mapped[date | None] = mapped_column(Date)
    closing_date: Mapped[date | None] = mapped_column(Date)
    funding_date: Mapped[date | None] = mapped_column(Date)
    disbursement_date: Mapped[date | None] = mapped_column(Date)
    initial_disclosure_date: Mapped[date | None] = mapped_column(Date)
    closing_disclosure_date: Mapped[date | None] = mapped_column(Date)
    closing_redisclosure_date: Mapped[date | None] = mapped_column(Date)
    le_redisclosure_date: Mapped[date | None] = mapped_column(Date)

    # ── Loan descriptor fields ─────────────────────────────────────────────────
    purpose: Mapped[LoanPurpose] = mapped_column(
        ENUM(LoanPurpose, **_LOAN_PURPOSE_COL),
        nullable=False,
        server_default=LoanPurpose.PURCHASE.value,
    )
    occupancy_type: Mapped[str | None] = mapped_column(String)
    loan_program: Mapped[str | None] = mapped_column(String)
    loan_product: Mapped[str | None] = mapped_column(String)
    purpose_detail: Mapped[str | None] = mapped_column(String)
    cashout_type: Mapped[str | None] = mapped_column(String)
    property_use: Mapped[str | None] = mapped_column(String)
    construction_type: Mapped[str | None] = mapped_column(String)
    product_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="loans")
    assignee: Mapped["User | None"] = relationship("User", back_populates="assigned_loans")
    financials: Mapped["LoanFinancials | None"] = relationship(
        "LoanFinancials",
        back_populates="loan",
        cascade="all, delete-orphan",
        uselist=False,
    )
    terms: Mapped["LoanTerms | None"] = relationship(
        "LoanTerms",
        back_populates="loan",
        cascade="all, delete-orphan",
        uselist=False,
    )
    borrowers: Mapped[list["Borrower"]] = relationship("Borrower", back_populates="loan", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="loan", cascade="all, delete-orphan")
    conditions: Mapped[list["Condition"]] = relationship("Condition", back_populates="loan", cascade="all, delete-orphan")
    parties: Mapped[list["LoanParty"]] = relationship("LoanParty", back_populates="loan", cascade="all, delete-orphan")
    properties: Mapped[list["Property"]] = relationship("Property", back_populates="loan", cascade="all, delete-orphan")
    exceptions: Mapped[list["LoanException"]] = relationship("LoanException", back_populates="loan", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="loan", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship("Note", back_populates="loan", cascade="all, delete-orphan")
    status_events: Mapped[list["LoanStatusEvent"]] = relationship(
        "LoanStatusEvent",
        back_populates="loan",
        cascade="all, delete-orphan",
    )
    pricing_runs: Mapped[list["PricingRun"]] = relationship("PricingRun", back_populates="loan", cascade="all, delete-orphan")
    eligibility_runs: Mapped[list["EligibilityRun"]] = relationship(
        "EligibilityRun",
        back_populates="loan",
        cascade="all, delete-orphan",
    )
    snapshots: Mapped[list["Snapshot"]] = relationship("Snapshot", back_populates="loan", cascade="all, delete-orphan")


class LoanFinancials(TimestampMixin, TenantMixin, Base):
    """Money amounts and risk ratios for a loan. 1:1 with loans via loan_id PK."""
    __tablename__ = "loan_financials"

    # loan_id is both the PK and the FK — enforces the 1:1 at the schema level
    # without an extra surrogate key column.
    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Numeric(14, 2): up to $999,999,999,999.99. Never Float for money.
    loan_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    appraised_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    down_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    ltv: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    cltv: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    fico_score: Mapped[int | None] = mapped_column(Integer)
    debt_to_income: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    dscr: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    cash_reserves: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    monthly_rent: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    monthly_income: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    monthly_debt: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    other_income: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    other_debt: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    principal_and_interest: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    escrow_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    total_monthly_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    property_taxes: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    homeowners_insurance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    hoa_fees: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    other_expenses: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    loan: Mapped[Loan] = relationship("Loan", back_populates="financials")


class LoanTerms(TimestampMixin, TenantMixin, Base):
    """Rate, rate-lock, and repayment structure for a loan. 1:1 with loans via loan_id PK."""
    __tablename__ = "loan_terms"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Rate lock fields: kept together because they describe a single event
    # (the rate was locked on rate_lock_date, for rate_lock_days, expiring on
    # lock_expiration_date).
    interest_rate_locked: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    rate_lock_date: Mapped[date | None] = mapped_column(Date)
    rate_lock_days: Mapped[int | None] = mapped_column(Integer)
    lock_expiration_date: Mapped[date | None] = mapped_column(Date)

    # Numeric(5, 3): three decimal places covers rates like 6.875%
    initial_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 3))
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 3))
    term_months: Mapped[int | None] = mapped_column(Integer)
    amortization_type: Mapped[str | None] = mapped_column(String)
    prepayment_penalty: Mapped[bool | None] = mapped_column(Boolean)
    rate_type: Mapped[str | None] = mapped_column(String)
    payment_type: Mapped[str | None] = mapped_column(String)

    loan: Mapped[Loan] = relationship("Loan", back_populates="terms")


class LoanParty(Base):
    __tablename__ = "loan_parties"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        primary_key=True,
    )
    party_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("parties.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    role: Mapped[LoanPartyRole] = mapped_column(
        ENUM(LoanPartyRole, **_LOAN_PARTY_ROLE_COL),
        primary_key=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    loan: Mapped[Loan] = relationship("Loan", back_populates="parties")
    party: Mapped["Party"] = relationship("Party", back_populates="loans")
