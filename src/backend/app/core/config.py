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

# ── Document / file storage ────────────────────────────────────────────────────
# STORAGE_BACKEND: "local" for dev; "s3" when Phase 3 is implemented.
STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
LOCAL_UPLOAD_DIR: str = os.getenv("LOCAL_UPLOAD_DIR", "/tmp/origina-uploads")
MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))

# Allowed MIME types for uploaded documents.
# Extend this list as new document types are required.
ALLOWED_MIME_TYPES: frozenset = frozenset({
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
    "application/xml",
    "text/xml",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})
