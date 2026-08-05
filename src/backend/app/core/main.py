from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import app.models  # noqa: F401 — registers all SQLAlchemy models so relationships resolve
from app.api.v1 import (
    admin_settings,
    analytics,
    appraisal,
    audit,
    auth,
    borrowers,
    cm,
    conditions,
    credit,
    decisioning,
    documents,
    escrow,
    exceptions,
    health,
    intake,
    loans,
    metadata,
    parties,
    properties,
    roles,
    status,
    tenants,
    title,
    users,
    users_me,
    workflow,
)
from app.core.config import ALLOWED_ORIGINS, APP_ENV
from app.core.logging import logger

app = FastAPI(
    title="Origina Backend Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Locked-down allowlist driven by ALLOWED_ORIGINS in app.core.config.
# Defaults to localhost ports 3000 and 3001 for local dev; override in staging/prod
# via the ALLOWED_ORIGINS env var (comma-separated).
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting (Sprint 5 §5.1) ──────────────────────────────────────────────
# The Limiter is created in app.api.v1.auth so the login endpoint can decorate
# itself. We attach the same instance to app.state here so /docs can render it
# and the exception handler can return a clean 429 body.
from app.api.v1.auth import limiter as auth_limiter  # noqa: E402
app.state.limiter = auth_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ── Global error handlers ──────────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    logger.exception("Unhandled server error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Routers ────────────────────────────────────────────────────────────────────

_V1 = "/api/v1"

app.include_router(health.router,         prefix=_V1)
app.include_router(analytics.router,     prefix=_V1)
app.include_router(intake.router,         prefix=_V1)
app.include_router(auth.router,           prefix=_V1)
app.include_router(tenants.router,        prefix=_V1)
app.include_router(users_me.router,       prefix=_V1)
app.include_router(users.router,          prefix=_V1)
app.include_router(roles.router,          prefix=_V1)
app.include_router(status.router,         prefix=_V1)
app.include_router(loans.router,          prefix=_V1)
app.include_router(borrowers.router,      prefix=_V1)
app.include_router(properties.router,     prefix=_V1)
app.include_router(documents.router,      prefix=_V1)
app.include_router(conditions.router,     prefix=_V1)
app.include_router(cm.router,             prefix=_V1)
app.include_router(exceptions.router,     prefix=_V1)
app.include_router(workflow.router,       prefix=_V1)
app.include_router(parties.router,        prefix=_V1)
app.include_router(decisioning.router,    prefix=_V1)
app.include_router(audit.router,          prefix=_V1)
app.include_router(metadata.router,       prefix=_V1)
app.include_router(admin_settings.router, prefix=_V1)
app.include_router(appraisal.router,      prefix=_V1)
app.include_router(credit.router,         prefix=_V1)
app.include_router(escrow.router,         prefix=_V1)
app.include_router(title.router,          prefix=_V1)


# ── Root ───────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Origina Backend Service",
        "environment": APP_ENV,
        "docs_url": "/docs",
        "api_prefix": _V1,
    }


@app.on_event("startup")
def on_startup():
    logger.info(f"Starting Origina backend in {APP_ENV} environment")
    # Sprint 4 §4.4 — pick up any domain events left unprocessed by a
    # crash on the previous run. Wrapped in try/except so startup never
    # fails when the DB is briefly unavailable.
    try:
        from app.services.event_service import run_dispatch_in_background
        run_dispatch_in_background()
    except Exception as exc:
        logger.warning(f"Startup event dispatch skipped: {exc}")


@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down Origina backend")
