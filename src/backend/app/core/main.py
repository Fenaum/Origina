from app.core.db import get_db
from app.core.config import APP_ENV, LOG_LEVEL, DATABASE_URL
from fastapi import FastAPI, Depends
from app.core.logging import logger

app = FastAPI(title="Origina Backend Service", version="1.0.0")
@app.get("/health")

def health_check():
    logger.info("Health check endpoint called")
    return {"status": "healthy", "environment": APP_ENV}
@app.get("/items/")
def read_items(db=Depends(get_db)):
    logger.debug("Reading items from the database")
    # Example query (assuming you have a model named Item)
    # items = db.query(Item).all()
    items = []  # Placeholder for actual database query
    return items
@app.on_event("startup")
def on_startup():
    logger.info(f"Starting up the application in {APP_ENV} environment")
@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down the application")    