# Loan ORM model and API endpoints for loan management. This module defines the data model for loans, including all relevant fields and relationships, as well as the API routes for creating, retrieving, updating, and deleting loan records. The model includes comprehensive details about the loan application, financial information, key dates, and loan specifics to support a wide range of loan products and use cases.
from typing import Any, Dict, Optional
from uuid import UUID   
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.schemas.loan_schema import LoanBase
from app.schemas.document_schema import DocumentBase
from app.schemas.user_schema import UserBase

 asdf a