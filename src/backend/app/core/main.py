from fastapi import FastAPI

# Importing app.models registers the SQLAlchemy model classes.
# That matters when SQLAlchemy needs to understand relationships between models.
import app.models  # noqa: F401
from app.api.v1 import borrowers, conditions, documents, health, loans, parties
from app.core.config import APP_ENV
from app.core.logging import logger


# This is the FastAPI application object.
# Uvicorn looks for this variable when you run:
# uvicorn app.core.main:app --reload
app = FastAPI(title="Origina Backend Service", version="1.0.0")


# Routers keep endpoint files small and organized.
# The prefix means loan routes become /api/v1/loans, /api/v1/loans/{id}, etc.
app.include_router(health.router, prefix="/api/v1")
app.include_router(loans.router, prefix="/api/v1")
app.include_router(borrowers.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(parties.router, prefix="/api/v1")
app.include_router(conditions.router, prefix="/api/v1")


@app.get("/")
def root():
    # A tiny root endpoint gives you a quick way to confirm the API is alive.
    return {
        "service": "Origina Backend Service",
        "environment": APP_ENV,
        "docs_url": "/docs",
        "api_prefix": "/api/v1",
    }


@app.on_event("startup")
def on_startup():
    # This runs once when the FastAPI process starts.
    logger.info(f"Starting up the application in {APP_ENV} environment")


@app.on_event("shutdown")
def on_shutdown():
    # This runs once when the FastAPI process is shutting down.
    logger.info("Shutting down the application")
