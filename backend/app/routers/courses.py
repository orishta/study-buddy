"""Course CRUD endpoints with per-course task-count aggregation."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Course, Task
from ..schemas import CourseCreate, CourseOut, CourseUpdate, CourseWithStats

router = APIRouter(prefix="/courses", tags=["courses"])


def _task_counts(db: Session, course_ids: list[int]) -> dict[int, dict[str, int]]:
    """Return {course_id: {status: count}} in a single aggregate query."""
    rows = (
        db.query(Task.course_id, Task.status, func.count(Task.id).label("n"))
        .filter(Task.course_id.in_(course_ids), Task.parent_task_id.is_(None))
        .group_by(Task.course_id, Task.status)
        .all()
    )
    counts: dict[int, dict[str, int]] = {}
    for cid, status, n in rows:
        counts.setdefault(cid, {})[status] = n
    return counts


@router.get("", response_model=list[CourseWithStats])
def list_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.is_active == True).order_by(Course.created_at).all()
    if not courses:
        return []
    counts = _task_counts(db, [c.id for c in courses])
    result = []
    for course in courses:
        c = counts.get(course.id, {})
        result.append(CourseWithStats(
            **CourseOut.model_validate(course).model_dump(),
            todo_count=c.get("Todo", 0),
            in_progress_count=c.get("In Progress", 0),
            done_count=c.get("Done", 0),
            total_count=sum(c.values()),
        ))
    return result


@router.post("", response_model=CourseOut, status_code=201)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    course = Course(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseWithStats)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.is_active == True).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    c = _task_counts(db, [course_id]).get(course_id, {})
    return CourseWithStats(
        **CourseOut.model_validate(course).model_dump(),
        todo_count=c.get("Todo", 0),
        in_progress_count=c.get("In Progress", 0),
        done_count=c.get("Done", 0),
        total_count=sum(c.values()),
    )


@router.put("/{course_id}", response_model=CourseOut)
def update_course(course_id: int, payload: CourseUpdate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_active = False
    db.commit()
