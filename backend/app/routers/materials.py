from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Course, MaterialTracking
from ..schemas import MaterialCreate, MaterialOut, MaterialUpdate

router = APIRouter(tags=["materials"])


@router.get("/courses/{course_id}/materials", response_model=list[MaterialOut])
def list_materials(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.is_active == True).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return db.query(MaterialTracking).filter(MaterialTracking.course_id == course_id).order_by(MaterialTracking.id).all()


@router.post("/courses/{course_id}/materials", response_model=MaterialOut, status_code=201)
def create_material(course_id: int, payload: MaterialCreate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id, Course.is_active == True).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    material = MaterialTracking(course_id=course_id, **payload.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.patch("/materials/{material_id}", response_model=MaterialOut)
def update_material(material_id: int, payload: MaterialUpdate, db: Session = Depends(get_db)):
    material = db.query(MaterialTracking).filter(MaterialTracking.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    updates = payload.model_dump(exclude_none=True)
    if "understanding_level" in updates and payload.understanding_level is not None:
        material.last_reviewed = datetime.utcnow()
    for field, value in updates.items():
        setattr(material, field, value)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/materials/{material_id}", status_code=204)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(MaterialTracking).filter(MaterialTracking.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()
