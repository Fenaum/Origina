from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.models.workflow import (
    ExceptionAuthorityRule,
    ExceptionEvent,
    LoanException,
)
from app.schemas.exception_schema import (
    DecisionRequest,
    ExceptionAuthorityRuleCreate,
    ExceptionAuthorityRuleOut,
    ExceptionAuthorityRuleUpdate,
    ExceptionCommentCreate,
    ExceptionCommentOut,
    ExceptionCreate,
    ExceptionDocumentCreate,
    ExceptionDocumentOut,
    ExceptionEventOut,
    ExceptionOut,
    ExceptionUpdate,
)
from app.security.roles import IT_ADMIN, ACCOUNT_MANAGER, UNDERWRITER, require_roles
from app.security.security import get_audited_db, get_current_user
from app.services.exception_repo import (
    add_comment,
    approve_exception,
    attach_document,
    deny_exception,
    log_event,
    withdraw_exception,
)

router = APIRouter(prefix="/exceptions", tags=["exceptions"])


def _get_or_404(exception_id: UUID, db: Session, tenant_id: UUID) -> LoanException:
    exc = db.get(LoanException, exception_id)
    if not exc or exc.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exc


# ── Authority rules ───────────────────────────────────────────────────────────
# IMPORTANT: These static-path routes MUST be registered before /{exception_id}.
# FastAPI matches routes top-to-bottom. If /{exception_id} came first, any
# request to /exceptions/authority-rules/ would be matched as exception_id=
# "authority-rules" and fail with a 422 UUID validation error.

@router.get("/authority-rules/", response_model=list[ExceptionAuthorityRuleOut],
            dependencies=[Depends(require_roles(UNDERWRITER, ACCOUNT_MANAGER, IT_ADMIN))])
def list_authority_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ExceptionAuthorityRule)
        .filter(ExceptionAuthorityRule.tenant_id == current_user.tenant_id)
        .all()
    )


@router.post("/authority-rules/", response_model=ExceptionAuthorityRuleOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles(IT_ADMIN))])
def create_authority_rule(
    payload: ExceptionAuthorityRuleCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_none=True)
    if "allowed_roles" not in data:
        data["allowed_roles"] = ["underwriter", "account_manager", "it_admin"]
    rule = ExceptionAuthorityRule(tenant_id=current_user.tenant_id, **data)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/authority-rules/{rule_id}", response_model=ExceptionAuthorityRuleOut,
              dependencies=[Depends(require_roles(IT_ADMIN))])
def update_authority_rule(
    rule_id: UUID,
    payload: ExceptionAuthorityRuleUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.get(ExceptionAuthorityRule, rule_id)
    if not rule or rule.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Authority rule not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ExceptionOut, status_code=status.HTTP_201_CREATED)
def create_exception(
    payload: ExceptionCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_none=True)
    exc = LoanException(
        tenant_id=current_user.tenant_id,
        requested_by=current_user.id,
        **data,
    )
    db.add(exc)
    db.flush()  # assigns exc.id before log_event
    log_event(db, exc, "created", current_user)
    db.commit()
    db.refresh(exc)
    return exc


@router.get("/", response_model=list[ExceptionOut])
def list_exceptions(
    loan_id: UUID | None = None,
    exception_source: str | None = None,
    status_filter: str | None = None,
    exception_type: str | None = None,
    severity: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(LoanException).filter(LoanException.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(LoanException.loan_id == loan_id)
    if exception_source:
        query = query.filter(LoanException.exception_source == exception_source)
    if status_filter:
        query = query.filter(LoanException.status == status_filter)
    if exception_type:
        query = query.filter(LoanException.exception_type == exception_type)
    if severity:
        query = query.filter(LoanException.severity == severity)
    return query.order_by(LoanException.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{exception_id}", response_model=ExceptionOut)
def get_exception(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(exception_id, db, current_user.tenant_id)


@router.patch("/{exception_id}", response_model=ExceptionOut)
def update_exception(
    exception_id: UUID,
    payload: ExceptionUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    updated_fields = payload.model_dump(exclude_unset=True)
    for k, v in updated_fields.items():
        setattr(exc, k, v)
    if updated_fields:
        log_event(db, exc, "updated", current_user, {"fields": list(updated_fields.keys())})
    db.commit()
    db.refresh(exc)
    return exc


@router.delete("/{exception_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_roles(IT_ADMIN))])
def delete_exception(
    exception_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    db.delete(exc)
    db.commit()
    return None


# ── Decision actions ──────────────────────────────────────────────────────────

@router.post("/{exception_id}/approve", response_model=ExceptionOut)
def approve(
    exception_id: UUID,
    payload: DecisionRequest = DecisionRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    return approve_exception(db, exc, payload.reason, current_user)


@router.post("/{exception_id}/deny", response_model=ExceptionOut)
def deny(
    exception_id: UUID,
    payload: DecisionRequest = DecisionRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    return deny_exception(db, exc, payload.reason, current_user)


@router.post("/{exception_id}/withdraw", response_model=ExceptionOut)
def withdraw(
    exception_id: UUID,
    payload: DecisionRequest = DecisionRequest(),
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    return withdraw_exception(db, exc, payload.reason, current_user)


# ── Events ────────────────────────────────────────────────────────────────────

@router.get("/{exception_id}/events", response_model=list[ExceptionEventOut])
def list_events(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_or_404(exception_id, db, current_user.tenant_id)
    return (
        db.query(ExceptionEvent)
        .filter(ExceptionEvent.exception_id == exception_id)
        .order_by(ExceptionEvent.occurred_at)
        .all()
    )


# ── Comments ──────────────────────────────────────────────────────────────────

@router.post("/{exception_id}/comments", response_model=ExceptionCommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    exception_id: UUID,
    payload: ExceptionCommentCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    return add_comment(db, exc, payload.body, payload.is_internal or False, current_user)


@router.get("/{exception_id}/comments", response_model=list[ExceptionCommentOut])
def list_comments(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.workflow import ExceptionComment
    _get_or_404(exception_id, db, current_user.tenant_id)
    return (
        db.query(ExceptionComment)
        .filter(ExceptionComment.exception_id == exception_id)
        .order_by(ExceptionComment.created_at)
        .all()
    )


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/{exception_id}/documents", response_model=ExceptionDocumentOut, status_code=status.HTTP_201_CREATED)
def attach_doc(
    exception_id: UUID,
    payload: ExceptionDocumentCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = _get_or_404(exception_id, db, current_user.tenant_id)
    return attach_document(db, exc, payload.document_id, current_user)


@router.get("/{exception_id}/documents", response_model=list[ExceptionDocumentOut])
def list_exception_docs(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.workflow import ExceptionDocument
    _get_or_404(exception_id, db, current_user.tenant_id)
    return (
        db.query(ExceptionDocument)
        .filter(ExceptionDocument.exception_id == exception_id)
        .all()
    )
