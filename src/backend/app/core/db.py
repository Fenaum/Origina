# Alchemy DB Configuration
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os   # Import os to read environment variables
from app.core.config import DATABASE_URL  # Import DATABASE_URL from config module

# Create the SQLAlchemy engine using the DATABASE_URL from environment variables

# Engine (connection factory to the database
# echo=True for SQL query logging
# echo=False to disable SQL query logging
engine = create_engine(DATABASE_URL, echo=False)  

# Create Session factory
# A session is a workspace for your objects to interact with the database
# autocommit=False means changes are not saved until you call commit()
# autoflush=False means changes are not sent to the database until you call commit()
# bind=engine connects the session to the engine we created
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")
# Example usage:
# from app.core.db import get_db
# db = next(get_db())  # Get a database session
# Ensure DATABASE_URL is set






