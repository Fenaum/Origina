# Initiate Database
from app.core.db import engine, SessionLocal
import app.models

app.models.Base.metadata.create_all(bind=engine)

