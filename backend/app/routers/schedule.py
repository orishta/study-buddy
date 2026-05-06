from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassSchedule, Course
from ..schemas import ClassSlotCreate, ClassSlotOut, ClassSlotUpdate

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _get_or_create_course(db: Session, subject_name: str, color_code: str) -> int:
    """Find existing course with same title or create one automatically."""
    existing = db.query(Course).filter(
        Course.title == subject_name, Course.is_active == True
    ).first()
    if existing:
        return existing.id
    course = Course(title=subject_name, color_code=color_code, emoji="📚")
    db.add(course)
    db.flush()
    return course.id


@router.get("", response_model=list[ClassSlotOut])
def list_slots(db: Session = Depends(get_db)):
    return (
        db.query(ClassSchedule)
        .filter(ClassSchedule.is_active == True)
        .order_by(ClassSchedule.day_of_week, ClassSchedule.start_time)
        .all()
    )


@router.post("", response_model=ClassSlotOut, status_code=201)
def create_slot(payload: ClassSlotCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    # Auto-create a linked course if none provided
    if not data.get("course_id"):
        data["course_id"] = _get_or_create_course(db, data["subject_name"], data.get("color_code", "#6B7C5E"))
    slot = ClassSchedule(**data)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.post("/bulk", response_model=list[ClassSlotOut], status_code=201)
def bulk_create(payload: list[ClassSlotCreate], db: Session = Depends(get_db)):
    slots = [ClassSchedule(**s.model_dump()) for s in payload]
    db.add_all(slots)
    db.commit()
    for s in slots:
        db.refresh(s)
    return slots


@router.put("/{slot_id}", response_model=ClassSlotOut)
def update_slot(slot_id: int, payload: ClassSlotUpdate, db: Session = Depends(get_db)):
    slot = db.query(ClassSchedule).filter(ClassSchedule.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(slot, field, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(ClassSchedule).filter(ClassSchedule.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_active = False
    db.commit()
