from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassSchedule
from ..schemas import ClassSlotCreate, ClassSlotOut, ClassSlotUpdate

router = APIRouter(prefix="/schedule", tags=["schedule"])


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
    slot = ClassSchedule(**payload.model_dump())
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
