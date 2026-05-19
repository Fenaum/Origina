# __init__.py — imports all model classes so they are registered with SQLAlchemy.
# Import order matters: base classes must come before any class that references them.

from app.models.base import AppendOnlyModel, Base, BaseModel, TenantMixin, TimestampMixin, UUIDMixin
from app.models.audit import AuditLog, Snapshot
from app.models.borrowers import Address, Borrower, BorrowerIncomeType, BorrowerRelationship, BorrowerType
from app.models.conditions import Condition, ConditionStatus
from app.models.decisioning import EligibilityRun, PricingRun
from app.models.document import Document
from app.models.loan import Loan, LoanParty, LoanPartyRole, LoanPurpose, LoanStatus
from app.models.parties import Party, PartyType
from app.models.properties import Property
from app.models.user import Role, Tenant, User, UserParty, UserRole
from app.models.workflow import (
    ExceptionSeverity,
    ExceptionStatus,
    LoanException,
    LoanStatusEvent,
    Note,
    Task,
    TaskPriority,
    TaskStatus,
)


__all__ = [
    # Base classes — import these when defining new models
    "AppendOnlyModel",
    "Base",
    "BaseModel",
    "TenantMixin",
    "TimestampMixin",
    "UUIDMixin",
    # Entities
    "Address",
    "AuditLog",
    "Borrower",
    "BorrowerIncomeType",
    "BorrowerRelationship",
    "BorrowerType",
    "Condition",
    "ConditionStatus",
    "Document",
    "EligibilityRun",
    "ExceptionSeverity",
    "ExceptionStatus",
    "Loan",
    "LoanException",
    "LoanParty",
    "LoanPartyRole",
    "LoanPurpose",
    "LoanStatus",
    "LoanStatusEvent",
    "Note",
    "Party",
    "PartyType",
    "PricingRun",
    "Property",
    "Role",
    "Snapshot",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "Tenant",
    "User",
    "UserParty",
    "UserRole",
]
