from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Course, Task
from ..schemas import CourseCreate, CourseOut, CourseUpdate, CourseWithStats

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseWithStats])
def list_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.is_active == True).order_by(Course.created_at).all()
    result = []
    for course in courses:
        tasks = db.query(Task).filter(
            Task.course_id == course.id,
            Task.parent_task_id == None,
        ).all()
        todo = sum(1 for t in tasks if t.status == "Todo")
        in_progress = sum(1 for t in tasks if t.status == "In Progress")
        done = sum(1 for t in tasks if t.status == "Done")
        result.append(CourseWithStats(
            **CourseOut.model_validate(course).model_dump(),
            todo_count=todo,
            in_progress_count=in_progress,
            done_count=done,
            total_count=len(tasks),
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
    tasks = db.query(Task).filter(
        Task.course_id == course_id,
        Task.parent_task_id == None,
    ).all()
    todo = sum(1 for t in tasks if t.status == "Todo")
    in_progress = sum(1 for t in tasks if t.status == "In Progress")
    done = sum(1 for t in tasks if t.status == "Done")
    return CourseWithStats(
        **CourseOut.model_validate(course).model_dump(),
        todo_count=todo,
        in_progress_count=in_progress,
        done_count=done,
        total_count=len(tasks),
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
