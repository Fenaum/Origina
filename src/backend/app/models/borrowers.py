from datetime import date
from decimal import Decimal
from enum import Enum
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, LargeBinary, Numeric, String
from sqlalchemy.dialects.postgresql import ENUM, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BorrowerType(str, Enum):
    PRIMARY_BORROWER = "primary_borrower"
    CO_BORROWER = "co_borrower"
    GUARANTOR = "guarantor"
    OTHER = "other"


class BorrowerRelationship(str, Enum):
    SPOUSE = "spouse"
    PARENT = "parent"
    SIBLING = "sibling"
    CHILD = "child"
    FRIEND = "friend"
    BUSINESS_PARTNER = "business_partner"
    OTHER = "other"


class BorrowerIncomeType(str, Enum):
    SALARY = "salary"
    HOURLY_WAGE = "hourly_wage"
    COMMISSION = "commission"
    BONUS = "bonus"
    SELF_EMPLOYMENT = "self_employment"
    RENTAL_INCOME = "rental_income"
    INVESTMENT_INCOME = "investment_income"
    RETIREMENT_INCOME = "retirement_income"
    OTHER = "other"


class Address(BaseModel):
    __tablename__ = "addresses"

    street1: Mapped[str | None] = mapped_column(String)
    street2: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    postal_code: Mapped[str | None] = mapped_column(String)
    country: Mapped[str | None] = mapped_column(String)


class Borrower(BaseModel):
    __tablename__ = "borrowers"

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[BorrowerType] = mapped_column(
        ENUM(BorrowerType, name="borrower_type", values_callable=lambda enum: [e.value for e in enum]),
        nullable=False,
    )
    first_name: Mapped[str | None] = mapped_column(String)
    last_name: Mapped[str | None] = mapped_column(String)
    ssn_last4: Mapped[str | None] = mapped_column(String(4))
    ssn_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    dob: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    current_address_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("addresses.id", ondelete="SET NULL"),
    )
    mailing_address_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("addresses.id", ondelete="SET NULL"),
    )
    borrower_relationship: Mapped[BorrowerRelationship | None] = mapped_column(
        ENUM(
            BorrowerRelationship,
            name="borrower_relationship",
            values_callable=lambda enum: [e.value for e in enum],
        )
    )
    income_type: Mapped[BorrowerIncomeType | None] = mapped_column(
        ENUM(BorrowerIncomeType, name="borrower_income_type", values_callable=lambda enum: [e.value for e in enum])
    )
    income_amount: Mapped[Decimal | None] = mapped_column(Numeric)

    ethnicity: Mapped[str | None] = mapped_column(String)
    race: Mapped[str | None] = mapped_column(String)
    gender: Mapped[str | None] = mapped_column(String)
    marital_status: Mapped[str | None] = mapped_column(String)
    dependents: Mapped[int | None] = mapped_column(Integer)
    employment_status: Mapped[str | None] = mapped_column(String)
    employer_name: Mapped[str | None] = mapped_column(String)
    job_title: Mapped[str | None] = mapped_column(String)
    years_on_job: Mapped[int | None] = mapped_column(Integer)
    years_in_profession: Mapped[int | None] = mapped_column(Integer)
    work_phone: Mapped[str | None] = mapped_column(String)
    work_email: Mapped[str | None] = mapped_column(String)

    loan: Mapped["Loan"] = relationship("Loan", back_populates="borrowers")
    current_address: Mapped[Address | None] = relationship("Address", foreign_keys=[current_address_id])
    mailing_address: Mapped[Address | None] = relationship("Address", foreign_keys=[mailing_address_id])
