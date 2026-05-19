from fastapi import APIRouter

from app.core.config import APP_ENV
from app.core.logging import logger


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def health_check():
    # This endpoint is intentionally simple.
    # It answers: "Is the API process running and able to return a response?"
    logger.info("Health check endpoint called")
    return {"status": "healthy", "environment": APP_ENV}
