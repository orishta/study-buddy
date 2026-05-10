"""Class schedule CRUD, bulk create, CSV/Excel/iCal import, and preview."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Optional
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
    if not data.get("course_id"):
        data["course_id"] = _get_or_create_course(db, data["subject_name"], data.get("color_code", "#6B7C5E"))
    slot = ClassSchedule(**data)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.post("/bulk", response_model=list[ClassSlotOut], status_code=201)
def bulk_create(payload: list[ClassSlotCreate], db: Session = Depends(get_db)):
    created = []
    for item in payload:
        data = item.model_dump()
        if not data.get("course_id"):
            data["course_id"] = _get_or_create_course(
                db, data["subject_name"], data.get("color_code", "#6B7C5E")
            )
        slot = ClassSchedule(**data)
        db.add(slot)
        created.append(slot)
    db.commit()
    for s in created:
        db.refresh(s)
    return created


class SlotPreview(BaseModel):
    """A parsed-but-not-saved schedule slot, used for the edit-before-import UI."""
    subject_name: str
    day_of_week: int
    start_time: str
    end_time: str
    instructor: Optional[str] = None
    room: Optional[str] = None
    color_code: str = "#6B7C5E"


@router.post("/preview", response_model=list[SlotPreview])
async def preview_schedule(file: UploadFile = File(...)):
    """Parse a CSV/Excel file and return the rows WITHOUT saving — for preview/edit UI."""
    from services.schedule_parser import parse_csv, parse_xlsx

    content = await file.read()
    fname = (file.filename or "").lower()

    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            slots_data = parse_xlsx(content)
        elif fname.endswith(".csv"):
            slots_data = parse_csv(content)
        else:
            raise HTTPException(
                status_code=422,
                detail="Unsupported file type. Upload a .csv or .xlsx file.",
            )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    return [SlotPreview(**s) for s in slots_data]


@router.post("/import", response_model=list[ClassSlotOut], status_code=201)
async def import_schedule(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accept a .csv or .xlsx file and bulk-create class slots from it."""
    from services.schedule_parser import parse_csv, parse_xlsx

    content = await file.read()
    fname = (file.filename or "").lower()

    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            slots_data = parse_xlsx(content)
        elif fname.endswith(".csv"):
            slots_data = parse_csv(content)
        else:
            raise HTTPException(
                status_code=422,
                detail="Unsupported file type. Upload a .csv or .xlsx file.",
            )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    created = []
    for data in slots_data:
        data["course_id"] = _get_or_create_course(db, data["subject_name"], data.get("color_code", "#6B7C5E"))
        slot = ClassSchedule(**data)
        db.add(slot)
        created.append(slot)

    db.commit()
    for slot in created:
        db.refresh(slot)
    return created


class ImportUrlRequest(BaseModel):
    url: str


@router.post("/preview-url", response_model=list[SlotPreview])
async def preview_url(body: ImportUrlRequest):
    """Fetch an iCal URL and return parsed class slots WITHOUT saving — for the edit-before-import UI."""
    import httpx
    from services.schedule_parser import parse_ical

    url = body.url.strip()
    if not url.startswith("http"):
        raise HTTPException(status_code=422, detail="URL must start with http:// or https://")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            content = resp.text
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch calendar: HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch calendar: {e}")

    if "BEGIN:VCALENDAR" not in content:
        raise HTTPException(status_code=422, detail="URL did not return a valid iCal calendar (missing BEGIN:VCALENDAR).")

    try:
        slots_data = parse_ical(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return [SlotPreview(**s) for s in slots_data]


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
