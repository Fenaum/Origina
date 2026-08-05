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

# ── Auth cookies (Sprint 5 §5.1) ───────────────────────────────────────────────
# httpOnly cookie name + secure flag. Secure is False in local/dev so the cookie
# can travel over plain HTTP; True in any other environment.
COOKIE_NAME: str = os.getenv("COOKIE_NAME", "origina_token")
COOKIE_SECURE: bool = APP_ENV not in ("local", "development")
COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
COOKIE_PATH: str = os.getenv("COOKIE_PATH", "/")

# ── Tenant bootstrap (Sprint 5 §5.3) ───────────────────────────────────────────
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
# Leave empty to disable the /tenants/bootstrap endpoint.
ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "")

# ── Rate limiting (Sprint 5 §5.1) ──────────────────────────────────────────────
# How many /auth/login attempts per IP per window before 429 kicks in.
LOGIN_RATE_LIMIT: str = os.getenv("LOGIN_RATE_LIMIT", "10/minute")

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
# Defaults: localhost:3000 and localhost:3001 for local dev.
# Override with ALLOWED_ORIGINS env var in staging/prod.
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
    ).split(",")
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

# ── Email notifications (Sprint 4 §4.4) ────────────────────────────────────────
# Disabled by default. Set SMTP_HOST in .env to enable; the consumer silently
# skips emails when NOTIFICATIONS_ENABLED is false. Never expose real creds
# in this file — read from the environment at boot.
SMTP_HOST:     str = os.getenv("SMTP_HOST", "")
SMTP_PORT:     int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER:     str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM:     str = os.getenv("SMTP_FROM", "noreply@origina.dev")
NOTIFICATIONS_ENABLED: bool = bool(SMTP_HOST)
