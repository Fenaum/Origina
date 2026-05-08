# __init__.py

from app.models.base import Base, BaseModel, TenantMixin, TimestampMixin, UUIDMixin
from app.models.audit import AuditLog, Snapshot
from app.models.borrowers import Address, Borrower
from app.models.conditions import Condition
from app.models.decisioning import EligibilityRun, PricingRun
from app.models.document import Document
from app.models.loan import Loan, LoanParty, LoanPartyRole, LoanPurpose, LoanStatus
from app.models.parties import Party
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
from app.models.conditions import ConditionStatus


__all__ = [
    "Address",
    "AuditLog",
    "Base",
    "BaseModel",
    "Borrower",
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
    "PricingRun",
    "Property",
    "Role",
    "Snapshot",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "Tenant",
    "TenantMixin",
    "TimestampMixin",
    "User",
    "UserParty",
    "UserRole",
    "UUIDMixin",
] # This list is optional but can help with IDE autocompletion and makes it clear what models are available in this module.

# This file imports all the model classes so that they are registered with SQLAlchemy.