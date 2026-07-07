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

# Guard: reject the hardcoded default in any non-local environment.
# In local dev, the default is allowed so the server starts without a .env file.
# In staging/production (APP_ENV != "local"), the server must not start with
# the insecure default — this prevents accidental deploys with the dev secret.
_INSECURE_DEFAULT = "change-me-in-production"
if APP_ENV != "local" and JWT_SECRET_KEY == _INSECURE_DEFAULT:
    raise RuntimeError(
        "JWT_SECRET_KEY must be set to a secure value in non-local environments. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# CORS — comma-separated list of allowed frontend origins.
# Default: localhost:3000 for local dev.
# Override with ALLOWED_ORIGINS env var in staging/prod.
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

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
