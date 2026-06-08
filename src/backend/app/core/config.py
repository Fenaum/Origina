import os

from dotenv import load_dotenv

load_dotenv()

APP_NAME = "Origina Backend Service"
VERSION = "1.0.0"

APP_ENV = os.getenv("APP_ENV", "local")
LOG_LEVEL = os.getenv("LOG_LEVEL", "debug")
DEBUG = APP_ENV in ["local", "development"]

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# JWT — set JWT_SECRET_KEY in .env before running in any environment.
# Use: python -c "import secrets; print(secrets.token_hex(32))" to generate one.
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
