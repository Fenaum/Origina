from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.models.workflow import LoanException, Note, Task
from app.schemas.common_schema import PaginatedResponse
from app.schemas.workflow_schema import (
    ExceptionCreate,
    ExceptionOut,
    ExceptionUpdate,
    NoteCreate,
    NoteOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.security.security import get_audited_db, get_current_user


router = APIRouter(tags=["workflow"])


# ── Tasks ──────────────────────────────────────────────────────────────────────

@router.post("/tasks/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    task = Task(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/tasks/", response_model=PaginatedResponse[TaskOut])
def list_tasks(
    loan_id: UUID | None = None,
    status_filter: str | None = None,
    assigned_to: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Task.loan_id == loan_id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if assigned_to:
        query = query.filter(Task.assigned_to == assigned_to)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return PaginatedResponse[TaskOut](items=items, total=total)



@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task or task.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task or task.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task or task.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.post("/notes/", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    note = Note(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        loan_id=payload.loan_id,
        body=payload.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/notes/", response_model=PaginatedResponse[NoteOut])
def list_notes(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Note).filter(Note.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(Note.loan_id == loan_id)
    total = query.count()
    items = query.order_by(Note.created_at.desc()).offset(skip).limit(limit).all()
    return PaginatedResponse[NoteOut](items=items, total=total)



# ── Exceptions ────────────────────────────────────────────────────────────────

@router.post("/exceptions/", response_model=ExceptionOut, status_code=status.HTTP_201_CREATED)
def create_exception(
    payload: ExceptionCreate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = LoanException(
        tenant_id=current_user.tenant_id,
        requested_by=current_user.id,
        **payload.model_dump(exclude={"tenant_id"}),
    )
    db.add(exc)
    db.commit()
    db.refresh(exc)
    return exc


@router.get("/exceptions/", response_model=PaginatedResponse[ExceptionOut])
def list_exceptions(
    loan_id: UUID | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(LoanException).filter(LoanException.tenant_id == current_user.tenant_id)
    if loan_id:
        query = query.filter(LoanException.loan_id == loan_id)
    if status_filter:
        query = query.filter(LoanException.status == status_filter)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return PaginatedResponse[ExceptionOut](items=items, total=total)



@router.get("/exceptions/{exception_id}", response_model=ExceptionOut)
def get_exception(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exc = db.get(LoanException, exception_id)
    if not exc or exc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exc


@router.patch("/exceptions/{exception_id}", response_model=ExceptionOut)
def update_exception(
    exception_id: UUID,
    payload: ExceptionUpdate,
    db: Session = Depends(get_audited_db),
    current_user: User = Depends(get_current_user),
):
    exc = db.get(LoanException, exception_id)
    if not exc or exc.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Exception not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(exc, k, v)
    db.commit()
    db.refresh(exc)
    return exc
