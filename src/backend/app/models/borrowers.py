from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, LargeBinary, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BorrowerType:
    """Canonical borrower type codes. Matches controlled_values set 'borrower_type'."""
    PRIMARY_BORROWER = "primary_borrower"
    CO_BORROWER      = "co_borrower"
    GUARANTOR        = "guarantor"
    OTHER            = "other"

    ALL: frozenset[str] = frozenset({"primary_borrower", "co_borrower", "guarantor", "other"})


class BorrowerRelationship:
    """Canonical co-borrower relationship codes. Matches controlled_values set 'borrower_relationship'."""
    SPOUSE           = "spouse"
    PARENT           = "parent"
    SIBLING          = "sibling"
    CHILD            = "child"
    FRIEND           = "friend"
    BUSINESS_PARTNER = "business_partner"
    OTHER            = "other"

    ALL: frozenset[str] = frozenset({
        "spouse", "parent", "sibling", "child", "friend", "business_partner", "other"
    })


class BorrowerIncomeType:
    """Canonical income type codes. Matches controlled_values set 'borrower_income_type'."""
    SALARY            = "salary"
    HOURLY_WAGE       = "hourly_wage"
    COMMISSION        = "commission"
    BONUS             = "bonus"
    SELF_EMPLOYMENT   = "self_employment"
    RENTAL_INCOME     = "rental_income"
    INVESTMENT_INCOME = "investment_income"
    RETIREMENT_INCOME = "retirement_income"
    OTHER             = "other"

    ALL: frozenset[str] = frozenset({
        "salary", "hourly_wage", "commission", "bonus", "self_employment",
        "rental_income", "investment_income", "retirement_income", "other"
    })


class Address(BaseModel):
    __tablename__ = "addresses"

    street1:     Mapped[str | None] = mapped_column(String)
    street2:     Mapped[str | None] = mapped_column(String)
    city:        Mapped[str | None] = mapped_column(String)
    state:       Mapped[str | None] = mapped_column(String)
    postal_code: Mapped[str | None] = mapped_column(String)
    country:     Mapped[str | None] = mapped_column(String)

    # Relationships back to borrowers are intentionally omitted: Address does
    # not know about its owner. Ownership is tracked via Borrower.current_address_id
    # and Borrower.mailing_address_id. Cleanup when a borrower is deleted is
    # handled by the DB trigger trg_cleanup_borrower_addresses (migration 104).


class Borrower(BaseModel):
    __tablename__ = "borrowers"

    __table_args__ = (
        CheckConstraint(
            "type IN ('primary_borrower','co_borrower','guarantor','other')",
            name="ck_borrower_type",
        ),
        CheckConstraint(
            "income_type IS NULL OR income_type IN ("
            "'salary','hourly_wage','commission','bonus','self_employment',"
            "'rental_income','investment_income','retirement_income','other')",
            name="ck_borrower_income_type",
        ),
        CheckConstraint(
            "borrower_relationship IS NULL OR borrower_relationship IN ("
            "'spouse','parent','sibling','child','friend','business_partner','other')",
            name="ck_borrower_relationship",
        ),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=BorrowerType.PRIMARY_BORROWER,
    )
    first_name: Mapped[str | None] = mapped_column(String)
    last_name:  Mapped[str | None] = mapped_column(String)
    # ssn_last4 stored as plaintext for display (show last 4 digits in UI).
    # Full SSN is in ssn_encrypted — application-level encryption; never stored
    # in plaintext. The encrypted column type is BYTEA (raw bytes), not TEXT.
    ssn_last4:     Mapped[str | None] = mapped_column(String(4))
    ssn_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    dob:           Mapped[date | None] = mapped_column(Date)
    phone:         Mapped[str | None] = mapped_column(String)
    email:         Mapped[str | None] = mapped_column(String)
    current_address_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        # SET NULL: if the address row is deleted, null the FK rather than
        # cascade-deleting the borrower. The trigger on borrowers handles the
        # reverse: deleting a borrower deletes its owned address rows.
        ForeignKey("addresses.id", ondelete="SET NULL"),
    )
    mailing_address_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("addresses.id", ondelete="SET NULL"),
    )
    borrower_relationship: Mapped[str | None] = mapped_column(String)
    income_type:           Mapped[str | None] = mapped_column(String)
    income_amount:         Mapped[Decimal | None] = mapped_column(Numeric)

    # ── URLA demographic fields ───────────────────────────────────────────────
    # Stored as TEXT to accommodate evolving regulatory classifications without
    # requiring ENUM migrations. Validated at the API layer via Pydantic.
    ethnicity:          Mapped[str | None] = mapped_column(String)
    race:               Mapped[str | None] = mapped_column(String)
    gender:             Mapped[str | None] = mapped_column(String)
    marital_status:     Mapped[str | None] = mapped_column(String)
    dependents:         Mapped[int | None] = mapped_column(Integer)
    employment_status:  Mapped[str | None] = mapped_column(String)
    employer_name:      Mapped[str | None] = mapped_column(String)
    job_title:          Mapped[str | None] = mapped_column(String)
    years_on_job:       Mapped[int | None] = mapped_column(Integer)
    years_in_profession: Mapped[int | None] = mapped_column(Integer)
    work_phone:         Mapped[str | None] = mapped_column(String)
    work_email:         Mapped[str | None] = mapped_column(String)

    loan:            Mapped["Loan"] = relationship("Loan", back_populates="borrowers")
    current_address: Mapped[Address | None] = relationship("Address", foreign_keys=[current_address_id])
    mailing_address: Mapped[Address | None] = relationship("Address", foreign_keys=[mailing_address_id])
