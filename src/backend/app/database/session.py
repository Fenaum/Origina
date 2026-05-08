# session.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

# Create the SQLAlchemy engine
# Data  base connection manager that will be used by the application to interact with the database. It is configured with the database URL from the application's settings.    
engine = create_engine(DATABASE_URL)

# Create a configured "Session" class
# sessionmaker is a factory for creating new Session objects. It is configured with the engine and options for how sessions should behave.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)