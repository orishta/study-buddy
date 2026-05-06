from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Task
from ..schemas import (
    TaskCreate, TaskOut, TaskReorder, TaskStatusUpdate,
    TaskUpdate, TaskWithSubtasks,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    status: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    parent_id: Optional[int] = Query(None, description="Pass 'none' to get top-level tasks only"),
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if status:
        q = q.filter(Task.status == status)
    if course_id is not None:
        q = q.filter(Task.course_id == course_id)
    # By default return only top-level tasks; pass parent_id=X to get subtasks
    if parent_id is not None:
        q = q.filter(Task.parent_task_id == parent_id)
    else:
        q = q.filter(Task.parent_task_id == None)
    return q.order_by(Task.position, Task.created_at).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskWithSubtasks)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    subtasks = db.query(Task).filter(Task.parent_task_id == task_id).order_by(Task.position).all()
    out = TaskWithSubtasks.model_validate(task)
    out.subtasks = [TaskOut.model_validate(s) for s in subtasks]
    return out


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = payload.model_dump(exclude_none=True)
    if "status" in updates and updates["status"] == "Done" and task.status != "Done":
        task.completed_at = datetime.utcnow()
    elif "status" in updates and updates["status"] != "Done":
        task.completed_at = None
    for field, value in updates.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/status", response_model=TaskOut)
def update_task_status(task_id: int, payload: TaskStatusUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.status not in ("Todo", "In Progress", "Done"):
        raise HTTPException(status_code=422, detail="Invalid status value")
    if payload.status == "Done" and task.status != "Done":
        task.completed_at = datetime.utcnow()
    elif payload.status != "Done":
        task.completed_at = None
    task.status = payload.status
    db.commit()
    db.refresh(task)
    return task


@router.patch("/reorder", response_model=list[TaskOut])
def reorder_tasks(payload: TaskReorder, db: Session = Depends(get_db)):
    updated = []
    for item in payload.tasks:
        task = db.query(Task).filter(Task.id == item.id).first()
        if task:
            task.position = item.position
            task.status = item.status
            updated.append(task)
    db.commit()
    for task in updated:
        db.refresh(task)
    return updated


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # Cascade: detach subtasks instead of deleting them
    db.query(Task).filter(Task.parent_task_id == task_id).update({"parent_task_id": None})
    db.delete(task)
    db.commit()
